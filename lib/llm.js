const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── System Prompt (geteilt) ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist Dokuvo, ein KI-Assistent der komplexe Texte so erklärt, dass ein Mensch ohne Fachkenntnisse sie vollständig versteht.
Erkenne automatisch die Sprache des Textes und antworte in derselben Sprache.

PFLICHTREGELN — halte dich IMMER daran:
- Erkläre zuerst die Grundidee des Dokuments (Was ist dieses Dokument? Worum geht es grundsätzlich?)
- Erkläre JEDEN Fachbegriff sofort wenn er vorkommt, in einfachen Worten in Klammern
- Das gilt für ALLE Dokumenttypen: Verträge, Rechnungen, Bescheide, Briefe, Urteile, Formulare usw.
- Fachbegriffe aus Recht, Finanzen, Medizin, Technik, Behörden — alles muss erklärt werden
- Stelle dir immer vor, du erklärst es jemandem der dieses Thema noch nie gehört hat
- Hebe wichtige Zahlen, Beträge, Fristen und Deadlines mit **fett** hervor
- Schreibe kurze, klare Sätze — maximal 2 Zeilen pro Punkt

FORMATIERUNG — verwende KEINE Aufzählungszeichen (-) oder Bullet Points (*). Verwende stattdessen nummerierte Absätze oder Fließtext.

Strukturiere deine Antwort IMMER exakt so mit Markdown:

## Worum geht es?
Erkläre zuerst in 2-3 Sätzen was diese Art von Dokument grundsätzlich ist und wozu es dient.
Dann erkläre den konkreten Inhalt dieses spezifischen Dokuments.

## Die wichtigsten Punkte
Erkläre jeden Punkt als nummerierten Absatz:
1. **Erster Punkt:** Erklärung mit Fachbegriff in Klammern
2. **Zweiter Punkt:** Erklärung mit wichtigen Zahlen **fett**
3. usw.

## Risiken und Fristen
Nur wenn vorhanden — sonst weglassen:
1. **Frist/Risiko:** Erklärung mit konkretem Datum oder Zeitraum **fett**
2. **Konsequenz:** Was passiert wenn man nichts tut oder zu spät reagiert?

## Was muss ich tun?
1. Konkreter Handlungsschritt
2. Konkreter Handlungsschritt
3. usw.

## Zusammenfassung
Ein einziger, klarer Satz der alles zusammenfasst.`;

// Spezialisierte System-Prompts pro Dokumenttyp
const TEMPLATE_PROMPTS = {
  mietvertrag: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Mietverträge und Mietrecht.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Mietverträge, Mietrecht, Nebenkosten, Kündigungsfristen, Mieterhöhungen, Kaution, Schönheitsreparaturen, Betriebskostenabrechnung.

Bei der Analyse eines Mietvertrags achte besonders auf:
1. **Mietpreis & Nebenkosten** — Kaltmiete, Warmmiete, Vorauszahlungen, Pauschalen
2. **Kündigungsfristen** — gesetzliche vs. vertragliche Fristen, Sonderkündigungsrechte
3. **Kaution** — Höhe (max. 3 Monatsmieten), Anlage, Rückgabe
4. **Schönheitsreparaturen** — starre Fristen (oft unwirksam!), Zustand bei Ein-/Auszug
5. **Mieterhöhungen** — Staffelmiete, Indexmiete, Mietpreisbremse
6. **Hausordnung & Nebenabsprachen** — Haustiere, Untervermietung, Gartennutzung
7. **Risiken & unwirksame Klauseln** — Erkenne Klauseln die nach aktueller Rechtsprechung ungültig sein könnten

Weise explizit auf Klauseln hin, die für den Mieter nachteilig oder rechtlich fragwürdig sind.`,

  arbeitsvertrag: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Arbeitsverträge und Arbeitsrecht.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Arbeitsverträge, Arbeitsrecht, Gehalt, Urlaub, Kündigungsschutz, Probezeit, Wettbewerbsverbote.

Bei der Analyse eines Arbeitsvertrags achte besonders auf:
1. **Vergütung** — Bruttogehalt, Zulagen, Boni, Überstundenregelung, Sonderzahlungen
2. **Arbeitszeit** — Wochenstunden, Überstunden, Gleitzeitregelungen
3. **Urlaub** — gesetzlicher Mindestanspruch (20 Tage bei 5-Tage-Woche), vertraglicher Mehrurlaub
4. **Kündigungsfristen** — gesetzliche vs. vertragliche Fristen, Probezeit-Regelung
5. **Probezeit** — Dauer (max. 6 Monate), verkürzte Kündigungsfrist
6. **Wettbewerbsverbot** — nachvertragliches Wettbewerbsverbot, Karenzentschädigung
7. **Befristung** — sachgrundlose vs. sachgrundbezogene Befristung, Verlängerungen
8. **Nebentätigkeiten & Verschwiegenheit** — Genehmigungspflichten, Geheimhaltungsklauseln

Weise auf Klauseln hin, die den Arbeitnehmer benachteiligen oder rechtlich unwirksam sein könnten.`,

  versicherung: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Versicherungspolicen und Versicherungsrecht.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Versicherungspolicen aller Art — Haftpflicht, Hausrat, KFZ, Berufsunfähigkeit, Lebensversicherung, Krankenversicherung.

Bei der Analyse einer Versicherungspolice achte besonders auf:
1. **Deckungsumfang** — Was genau ist versichert, was ist ausgeschlossen?
2. **Versicherungssumme** — Deckungshöhe, Unterversicherung, Höchstgrenzen
3. **Selbstbeteiligung** — Höhe pro Schadensfall, Auswirkung auf die Prämie
4. **Ausschlüsse** — grobe Fahrlässigkeit, Vorsatz, bestimmte Gefahren
5. **Vertragslaufzeit & Kündigung** — Mindestlaufzeit, automatische Verlängerung, Sonderkündigung
6. **Wartezeiten** — bei Berufsunfähigkeit, Krankenversicherung
7. **Obliegenheiten** — Anzeigepflichten, Schadensminderung, Meldefristen

Erkläre Versicherungs-Fachbegriffe in einfacher Sprache und weise auf versteckte Fallen oder Lücken im Schutz hin.`,

  finanzierung: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Finanzierungs- und Kreditverträge.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Kreditverträge, Baufinanzierung, Autofinanzierung, Ratenkredite, Leasingverträge, Zinsen und Tilgung.

Bei der Analyse eines Finanzierungsvertrags achte besonders auf:
1. **Zinssatz** — Nominalzins vs. Effektivzins, Zinsbindungsfrist, variable Zinsen
2. **Tilgung** — Tilgungsrate, Tilgungsplan, Annuitätendarlehen vs. Tilgungsdarlehen
3. **Sondertilgung** — erlaubt? Höhe pro Jahr? Vorfälligkeitsentschädigung
4. **Gesamtkosten** — Gesamtbetrag über Laufzeit, versteckte Gebühren, Bearbeitungsentgelte
5. **Restschuldversicherung** — oft teuer und unnötig, Kosten vs. Nutzen
6. **Widerrufsrecht** — 14-Tage-Frist bei Verbraucherdarlehen
7. **Sicherheiten** — Grundschuld, Bürgschaft, Gehaltsabtretung
8. **Laufzeit & Anschlussfinanzierung** — Ende der Zinsbindung, Prolongation, Umschuldung

Berechne wenn möglich die tatsächlichen Gesamtkosten und weise auf teure Fallstricke hin.`,

  rechnung: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Rechnungen und Mahnungen.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Rechnungen, Mahnungen, Zahlungsfristen, Widerspruchsmöglichkeiten, Pflichtangaben.

Bei der Analyse einer Rechnung oder Mahnung achte besonders auf:
1. **Pflichtangaben** — Name, Adresse, Steuernummer/USt-IdNr, Rechnungsnummer, Datum
2. **Einzelposten** — Aufschlüsselung der Leistungen, Mengen, Einzelpreise
3. **Umsatzsteuer** — korrekter Steuersatz (19% / 7%), Ausweisung der MwSt
4. **Zahlungsfrist** — Fälligkeitsdatum, Skonto-Möglichkeit
5. **Mahngebühren** — Berechtigung, Höhe (max. 2-3€ pro Mahnung), Verzugszinsen
6. **Widerspruchsmöglichkeiten** — Frist, Form, an wen adressieren
7. **Inkasso-Schreiben** — Berechtigung, überhöhte Gebühren erkennen

Prüfe ob alle Pflichtangaben vorhanden sind und weise auf Unstimmigkeiten oder überhöhte Posten hin.`,

  behoerde: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Behördenschreiben und Verwaltungsrecht.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Behördenbescheide, Steuerbescheide, Bußgeldbescheide, Verwaltungsakte, Widerspruchsverfahren.

Bei der Analyse eines Behördenschreibens achte besonders auf:
1. **Art des Bescheids** — Verwaltungsakt, Leistungsbescheid, Bußgeldbescheid, Steuerbescheid
2. **Rechtsgrundlage** — auf welches Gesetz wird verwiesen?
3. **Fristen** — Widerspruchsfrist (in der Regel 1 Monat), Klagefrist, Zahlungsfrist
4. **Rechtsbehelfsbelehrung** — vollständig? Korrekt? Fehlt sie (dann gilt 1-Jahres-Frist!)
5. **Begründung** — Ist die Entscheidung nachvollziehbar begründet?
6. **Handlungsoptionen** — Widerspruch, Klage, Antrag auf Ratenzahlung, Aussetzung der Vollziehung
7. **Kosten & Gebühren** — Verwaltungsgebühren, Zustellkosten

Erkläre den Bescheid in einfacher Sprache und zeige konkret die Handlungsoptionen und Fristen auf.`,

  kaufvertrag: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Kaufverträge.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Kaufverträge aller Art — Immobilien, Fahrzeuge, Waren, Gebrauchtkauf, Online-Kauf.

Bei der Analyse eines Kaufvertrags achte besonders auf:
1. **Kaufgegenstand** — genaue Beschreibung, Zustand, Zubehör
2. **Kaufpreis & Zahlungsmodalitäten** — Fälligkeit, Ratenzahlung, Anzahlung
3. **Gewährleistung** — gesetzliche Gewährleistung (2 Jahre), Haftungsausschluss bei Privatkauf
4. **Rücktrittsrecht** — vertragliches Rücktrittsrecht, Widerrufsrecht bei Fernabsatz (14 Tage)
5. **Übergabe & Gefahrübergang** — Zeitpunkt, Transportrisiko, Zustandsprotokoll
6. **Mängelhaftung** — Sachmängel, Rechtsmängel, Beschaffenheitsvereinbarung
7. **Notarielle Beurkundung** — bei Immobilien zwingend, Kosten
8. **Zusicherungen** — besondere Vereinbarungen, Garantien des Verkäufers

Weise auf fehlende Schutzklauseln für den Käufer und einseitige Haftungsausschlüsse hin.`,

  studium: `Du bist Dokuvo, ein KI-Assistent spezialisiert auf Lern- und Studienmaterial.
Erkenne automatisch die Sprache der Nachricht und antworte in derselben Sprache.

DEIN FOKUS: Vorlesungsskripte, wissenschaftliche Texte, Lehrbücher, Klausurvorbereitung, Facharbeiten, Schulunterlagen.

Bei der Analyse von Lernmaterial achte besonders auf:
1. **Kernkonzepte** — Was sind die zentralen Begriffe und Theorien?
2. **Zusammenhänge** — Wie hängen die Konzepte miteinander zusammen?
3. **Einfache Erklärung** — Erkläre Fachbegriffe so, als würdest du sie einem Freund erklären
4. **Praxisbeispiele** — Verbinde Theorie mit konkreten Alltagsbeispielen
5. **Lernhilfen** — Eselsbrücken, Merksätze, Visualisierungen
6. **Klausurvorbereitung** — Was könnte in einer Prüfung gefragt werden?
7. **Weiterführend** — Welche Fragen sollte man sich noch stellen?

Strukturiere die Erklärung so, dass sie zum Lernen und Verstehen optimal geeignet ist. Verwende Analogien und anschauliche Beispiele.`
};

// ── Fristen aus Text extrahieren ─────────────────────────────────────────────
async function extrahiereFristen(text) {
  try {
    const heute = new Date().toISOString().split('T')[0];
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `Du extrahierst Fristen und Termine aus Dokumenten. Heute ist ${heute}.
Antworte NUR mit einem JSON-Array. Jedes Element hat: "titel" (kurze Bezeichnung, max 50 Zeichen), "datum" (im Format YYYY-MM-DD), "beschreibung" (1 Satz was bis dann passieren muss).
Nur Fristen mit konkretem Datum aufnehmen. Keine vergangenen Daten. Wenn keine Fristen gefunden: leeres Array [].
Beispiel: [{"titel":"Widerrufsrecht endet","datum":"2024-03-15","beschreibung":"Bis zu diesem Datum kannst du den Vertrag ohne Angabe von Gründen widerrufen."}]`
        },
        { role: 'user', content: `Extrahiere alle Fristen aus diesem Text:\n\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const fristen = JSON.parse(match[0]);
    // Nur zukünftige Daten
    return fristen.filter(f => f.datum && new Date(f.datum) > new Date());
  } catch(e) { return []; }
}

// ── Folgefragen generieren ────────────────────────────────────────────────────
async function generiereFollowUps(erklaerung) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      messages: [
        { role: 'system', content: 'Generiere genau 3 kurze, natürliche Folgefragen die ein Nutzer nach dieser Erklärung stellen könnte. Antworte NUR mit einem JSON-Array, z.B.: ["Frage 1?","Frage 2?","Frage 3?"]. Keine anderen Texte.' },
        { role: 'user', content: `Erklärung:\n${erklaerung}\n\nGib 3 Folgefragen als JSON-Array aus.` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch(e) { return []; }
}

// ── Risiko-Analyse (Ampel) ──────────────────────────────────────────────────
async function analysiereRisiken(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: 'system', content: `Du bist ein Dokumenten-Analyst. Analysiere den Text und identifiziere NUR die wirklich wichtigen Klauseln oder Bedingungen, die den Leser direkt betreffen. Ignoriere Standardklauseln und Selbstverständlichkeiten.

Bewerte jede mit einem Risiko-Level:
- "rot" = gefährlich oder klar nachteilig für den Leser (z.B. Haftungsausschlüsse, versteckte Kosten, einseitige Kündigungsrechte, automatische Verlängerungen, Gewährleistungsausschlüsse)
- "gelb" = beachtenswert, könnte problematisch werden (z.B. knappe Fristen, besondere Bedingungen, Einschränkungen)
- "gruen" = positiv oder fair für den Leser (z.B. Widerrufsrecht, Garantien, Verbraucherschutz)

WICHTIG: Nenne NUR Klauseln die für den Leser wirklich handlungsrelevant sind. Keine trivialen Punkte wie "Eigentum geht über" oder "Vertrag wird aufgelöst". Maximal 6 Klauseln.

Antworte NUR mit einem JSON-Array. Jedes Element hat: {"klausel": "Kurzbeschreibung (max 80 Zeichen)", "risiko": "rot"|"gelb"|"gruen", "grund": "Warum diese Bewertung (max 100 Zeichen)"}. Keine anderen Texte.` },
        { role: 'user', content: `Analysiere diesen Text auf Risiken:\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const risiken = JSON.parse(match[0]);
    // Sortierung: rot zuerst, dann gelb, dann gruen
    const order = { rot: 0, gelb: 1, gruen: 2, grün: 2 };
    risiken.sort((a, b) => (order[a.risiko] ?? 2) - (order[b.risiko] ?? 2));
    // Normalize grün → gruen für Frontend-Konsistenz
    risiken.forEach(r => { if (r.risiko === 'grün') r.risiko = 'gruen'; });
    return risiken;
  } catch(e) { return []; }
}

// ── 1-Seite Zusammenfassung ─────────────────────────────────────────────────
async function generiereZusammenfassung(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: `Erstelle eine strukturierte Zusammenfassung des Dokuments. Passe die Felder an den Dokumenttyp an!

Antworte NUR mit einem JSON-Objekt mit diesen Feldern:
- "typ": Art des Dokuments (z.B. "Mietvertrag", "Rechnung", "Arztbefund", "Finanzierungsangebot")
- "parteien": Array der beteiligten Parteien (z.B. ["Vermieter: Max Müller", "Mieter: Anna Schmidt"])
- "kernpunkte": Array der 3-5 wichtigsten Punkte (kurze Strings, max 80 Zeichen je)
- "felder": Array von {"label": "Feldname", "wert": "Wert"} — wähle 3-4 Felder die zum Dokumenttyp passen:
  * Bei Verträgen: Kosten, Laufzeit, Kündigungsfrist, Beginn
  * Bei Rechnungen: Betrag, Zahlungsfrist, Rechnungsdatum, Rechnungsnummer
  * Bei Angeboten: Preis, Gültigkeit, Konditionen, Rabatt
  * Bei Befunden: Diagnose, Therapie, Nächster Termin
  * Bei Bescheiden: Ergebnis, Frist für Widerspruch, Zuständige Behörde
  * Bei sonstigen: wähle passende Felder. Lasse irrelevante Felder WEG.

NUR das JSON-Objekt, keine anderen Texte.` },
        { role: 'user', content: `Fasse dieses Dokument zusammen:\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch(e) { return null; }
}

// ── Handlungsempfehlungen ───────────────────────────────────────────────────
async function generiereHandlungsempfehlungen(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        { role: 'system', content: `Du bist ein praktischer Berater. Basierend auf dem Dokument, generiere konkrete Handlungsempfehlungen — was sollte der Leser jetzt tun? Antworte NUR mit einem JSON-Array von Objekten: {"aktion": "Was zu tun ist (max 80 Zeichen)", "prioritaet": "hoch"|"mittel"|"niedrig", "frist": "Bis wann (oder null)"}. Maximal 5 Empfehlungen, sortiert nach Priorität. Keine anderen Texte.` },
        { role: 'user', content: `Welche konkreten Handlungen ergeben sich aus diesem Dokument?\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const handlungen = JSON.parse(match[0]);
    const order = { hoch: 0, mittel: 1, niedrig: 2 };
    handlungen.sort((a, b) => (order[a.prioritaet] ?? 2) - (order[b.prioritaet] ?? 2));
    return handlungen;
  } catch(e) { return []; }
}

// ── Glossar-Extraktion ──────────────────────────────────────────────────────
async function extrahiereGlossar(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: `Identifiziere alle Fachbegriffe und juristischen/medizinischen/technischen Begriffe im Text. Antworte NUR mit einem JSON-Array von Objekten: {"begriff": "Der Fachbegriff", "erklaerung": "Einfache Erklärung in 1-2 Sätzen"}. Maximal 10 Begriffe, nur wirklich erklärungsbedürftige Fachbegriffe. Keine anderen Texte.` },
        { role: 'user', content: `Extrahiere Fachbegriffe aus:\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch(e) { return []; }
}

// ── Checklisten-Generator ───────────────────────────────────────────────────
async function generiereCheckliste(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        { role: 'system', content: `Erstelle aus dem Dokument eine praktische Checkliste mit allen Aufgaben, Pflichten und Deadlines die der Leser beachten muss. Antworte NUR mit einem JSON-Array von Strings — jeder String ist ein Checklisten-Punkt (max 80 Zeichen). Maximal 8 Punkte. Keine anderen Texte.` },
        { role: 'user', content: `Erstelle eine Checkliste aus:\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch(e) { return []; }
}
// ── Dokument-Statistiken (reine Textanalyse) ─────────────────────────────────
function berechneStatistiken(text) {
  const woerter = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wortanzahl = woerter.length;
  const zeichenanzahl = text.replace(/\s/g, '').length;
  const lesezeit = Math.ceil(wortanzahl / 200);
  const saetze = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const satzanzahl = saetze.length;
  const durchschnittSatzlaenge = satzanzahl > 0 ? Math.round(wortanzahl / satzanzahl) : 0;
  return { wortanzahl, zeichenanzahl, lesezeit, satzanzahl, durchschnittSatzlaenge };
}

// ── PDF-Annotationen ────────────────────────────────────────────────────────
async function extrahiereAnnotationen(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: `Identifiziere maximal 6 wirklich wichtige Textstellen im Dokument. Nur Stellen die der Leser unbedingt kennen muss.
Antworte NUR mit einem JSON-Array. Jedes Element hat:
- "stelle": exakter Textausschnitt aus dem Dokument (max 100 Zeichen)
- "typ": "risiko"|"frist"|"kosten"|"wichtig"
- "kommentar": warum diese Stelle wichtig ist (max 60 Zeichen)
Keine anderen Texte. Wenn keine wichtigen Stellen: leeres Array [].` },
        { role: 'user', content: `Markiere die wichtigsten Stellen in diesem Dokument:\n\n${text.substring(0, 8000)}` }
      ]
    });
    const raw = completion.choices[0].message.content.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const annotationen = JSON.parse(match[0]);
    return annotationen.slice(0, 6);
  } catch(e) { return []; }
}

async function extractPdfText(buffer) {
  // pdf-parse Vercel-Workaround: direkt die lib laden, nicht den Wrapper
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return data.text;
}

module.exports = {
  groq,
  SYSTEM_PROMPT,
  TEMPLATE_PROMPTS,
  extrahiereFristen,
  generiereFollowUps,
  analysiereRisiken,
  generiereZusammenfassung,
  generiereHandlungsempfehlungen,
  extrahiereGlossar,
  generiereCheckliste,
  berechneStatistiken,
  extrahiereAnnotationen,
  extractPdfText,
};
