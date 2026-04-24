const express = require('express');
const { supabase } = require('../lib/db');
const { verifyUser } = require('../lib/auth');
const { sendTeamInviteEmail } = require('../lib/email');
const { renderInviteInvalid } = require('../lib/share-template');

const APP_URL = process.env.APP_URL || 'https://eli10-app-olxw.vercel.app';
const router = express.Router();

// Team erstellen
router.post('/teams', verifyUser, async (req, res) => {
  const { user_id, name } = req.body;
  if (!name) return res.status(400).json({ error: 'Teamname fehlt' });
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name, owner_id: user_id })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('team_members').insert({ team_id: team.id, user_id, email: req.authUser.email, role: 'owner' });
    res.json(team);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Teams des Users laden
router.get('/teams/:user_id', verifyUser, async (req, res) => {
  try {
    const userId = req.params.user_id;
    const userEmail = req.authUser.email;

    const { data: byId, error: e1 } = await supabase
      .from('team_members')
      .select('id, role, user_id, teams(id, name, owner_id, created_at)')
      .eq('user_id', userId);
    if (e1) return res.status(500).json({ error: e1.message });

    let byEmail = [];
    if (userEmail) {
      const { data: emailData } = await supabase
        .from('team_members')
        .select('id, role, user_id, teams(id, name, owner_id, created_at)')
        .eq('email', userEmail)
        .is('user_id', null);
      if (emailData?.length) {
        byEmail = emailData;
        const memberIds = emailData.map(m => m.id);
        await supabase.from('team_members').update({ user_id: userId }).in('id', memberIds);
      }
    }

    const allMembers = [...(byId || []), ...byEmail];
    const seen = new Set();
    const teams = [];
    for (const d of allMembers) {
      if (d.teams && !seen.has(d.teams.id)) {
        seen.add(d.teams.id);
        teams.push({ ...d.teams, role: d.role });
      }
    }

    const teamIds = teams.map(t => t.id);
    const memberCountMap = {};
    const sharedCountMap = {};
    if (teamIds.length) {
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds);
      for (const row of (memberRows || [])) {
        memberCountMap[row.team_id] = (memberCountMap[row.team_id] || 0) + 1;
      }
      const { data: sharedRows } = await supabase
        .from('team_shares')
        .select('team_id')
        .in('team_id', teamIds);
      for (const row of (sharedRows || [])) {
        sharedCountMap[row.team_id] = (sharedCountMap[row.team_id] || 0) + 1;
      }
    }

    const teamsWithCounts = teams.map(t => ({
      ...t,
      member_count: memberCountMap[t.id] || 0,
      shared_count: sharedCountMap[t.id] || 0
    }));

    res.json(teamsWithCounts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mitglied per E-Mail einladen
router.post('/teams/:id/invite', verifyUser, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-Mail fehlt' });
  try {
    const inviterId = req.authUser.id;
    const { data: inviter } = await supabase.from('team_members')
      .select('id, role, can_invite').eq('team_id', req.params.id).eq('user_id', inviterId).maybeSingle();
    if (!inviter) return res.status(403).json({ error: 'Du bist kein Mitglied dieses Teams' });
    if (inviter.role !== 'owner' && !inviter.can_invite) {
      return res.status(403).json({ error: 'Du hast keine Berechtigung, Mitglieder einzuladen' });
    }

    const { data: existingByEmail } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('email', email).maybeSingle();
    if (existingByEmail) return res.status(409).json({ error: 'Diese E-Mail ist bereits eingeladen' });

    let inviteeUserId = null;
    try {
      const { data: inviteeData } = await supabase.auth.admin.getUserByEmail(email);
      if (inviteeData?.user?.id) inviteeUserId = inviteeData.user.id;
    } catch {}
    const insertPayload = { team_id: req.params.id, email, role: 'member' };
    if (inviteeUserId) insertPayload.user_id = inviteeUserId;
    const { error: insertError } = await supabase.from('team_members').insert(insertPayload);
    if (insertError) return res.status(500).json({ error: insertError.message });

    const { data: teamData } = await supabase.from('teams').select('name').eq('id', req.params.id).single();
    const teamName = teamData?.name || 'einem Dokuvo-Team';

    try {
      const emailResult = await sendTeamInviteEmail(email, teamName, `${APP_URL}/join-team/${req.params.id}/${encodeURIComponent(email)}`);
      console.log('Resend Result:', JSON.stringify(emailResult.data));
    } catch (mailErr) {
      console.error('Einladungs-E-Mail Fehler:', mailErr.message);
      if (mailErr.response) console.error('Resend Error Details:', JSON.stringify(mailErr.response.data));
    }

    res.json({ success: true, email, message: 'Einladung gesendet' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team-Mitglieder laden
router.get('/teams/:id/members', verifyUser, async (req, res) => {
  try {
    const { data, error } = await supabase.from('team_members')
      .select('id, user_id, email, role, can_invite, created_at')
      .eq('team_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team-Mitglied entfernen
router.delete('/teams/:id/members/:memberId', verifyUser, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const { data: ownerCheck } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('user_id', userId).eq('role', 'owner').maybeSingle();
    if (!ownerCheck) return res.status(403).json({ error: 'Nur der Eigentümer kann Mitglieder entfernen' });

    const { error } = await supabase.from('team_members')
      .delete().eq('id', req.params.memberId).eq('team_id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Einladeberechtigung eines Mitglieds togglen (nur Owner)
router.patch('/teams/:id/members/:memberId/can-invite', verifyUser, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const { data: ownerCheck } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('user_id', userId).eq('role', 'owner').maybeSingle();
    if (!ownerCheck) return res.status(403).json({ error: 'Nur der Owner kann Berechtigungen ändern' });

    const { can_invite } = req.body;
    const { error } = await supabase.from('team_members')
      .update({ can_invite: !!can_invite })
      .eq('id', req.params.memberId).eq('team_id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, can_invite: !!can_invite });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chat-Session mit Team teilen
router.post('/teams/:id/share', verifyUser, async (req, res) => {
  const { user_id, session_id, note } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id fehlt' });
  try {
    const { data: member } = await supabase.from('team_members')
      .select('id').eq('team_id', req.params.id).eq('user_id', user_id).single();
    if (!member) return res.status(403).json({ error: 'Kein Mitglied dieses Teams' });

    const { data, error } = await supabase.from('team_shares')
      .insert({ team_id: req.params.id, session_id, shared_by: user_id, note: note || null })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Geteilte Sessions im Team laden
router.get('/teams/:id/shared', verifyUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('team_shares')
      .select('id, session_id, note, shared_by, created_at')
      .eq('team_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const sessionIds = (data || []).map(d => d.session_id);
    const { data: titles } = sessionIds.length
      ? await supabase.from('chat_titles').select('session_id, title').in('session_id', sessionIds)
      : { data: [] };
    const titleMap = {};
    (titles || []).forEach(t => { titleMap[t.session_id] = t.title; });

    const result = (data || []).map(d => ({ ...d, title: titleMap[d.session_id] || d.session_id }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team beitreten via E-Mail-Link (öffentlich, kein Auth)
router.get('/join-team/:teamId/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { data: member } = await supabase.from('team_members')
      .select('id, user_id, teams(name)')
      .eq('team_id', req.params.teamId)
      .eq('email', email)
      .maybeSingle();
    if (!member) {
      return res.status(404).send(renderInviteInvalid(APP_URL));
    }

    if (!member.user_id) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserByEmail(email);
        if (userData?.user?.id) {
          await supabase.from('team_members').update({ user_id: userData.user.id }).eq('id', member.id);
        }
      } catch {}
    }

    const teamName = member.teams?.name || 'dem Team';
    res.redirect(`${APP_URL}/app?joined=${encodeURIComponent(teamName)}`);
  } catch (err) { res.status(500).send('Serverfehler'); }
});

// Team löschen (nur Owner)
router.delete('/teams/:id', verifyUser, async (req, res) => {
  try {
    const userId = req.authUser.id;
    const { data: team } = await supabase.from('teams')
      .select('owner_id').eq('id', req.params.id).single();
    if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });
    if (team.owner_id !== userId) return res.status(403).json({ error: 'Nur der Eigentümer kann das Team löschen' });

    const { error } = await supabase.from('teams').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
