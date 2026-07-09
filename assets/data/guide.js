/* Day-to-Day Guide content (v7).
   Plain-English patrol walkthroughs for recruits, summarised from the BBRP 2024
   Police Handbook, the GD Handbook (2025) and the Melbourne Police Help Guide (2025).
   Static reference only — the renderer (assets/js/guide.js) turns this into the
   scenario picker, read-aloud radio calls and "jump into the right report"
   buttons. Nothing here writes report state on its own.

   Shapes:
   - GUIDE_GOLDEN_RULES : string[]  (HTML list items)
   - GUIDE_COPY         : { id, label, icon, text }[]  (radio-call scripts shown in the read-aloud accordion)
   - GUIDE_QUICKREF_HTML: string    (radio codes + priority mini-tables)
   - GUIDE_SCENARIOS    : { id, icon, label, html }[]

   Jump buttons inside scenario HTML use:
     data-guide-jump="report"  data-report-type="<type>"  [data-id-status="CONFIRMED|UNCONFIRMED"]
     data-guide-jump="traffic" | "ocr"
     data-guide-topic="<recruit-helper-id>"   (opens the deeper handbook topic)
     data-guide-read="<GUIDE_COPY id>"        (opens that script's read-aloud accordion row)
*/

/* ── The golden rules — read these first ───────────────────────────── */
const GUIDE_GOLDEN_RULES = [
  'Reports are legal documents. <strong>No police codes, no slang</strong> — write "traffic stop", not "Code 4"; "discharged their firearm", not "shot him".',
  '<strong>One incident = one report.</strong> Don\'t double up paperwork for something already actioned.',
  '<strong>Use the S.E.L.F test</strong> before you act — is it able to withstand <strong>S</strong>crutiny, is it <strong>E</strong>thical, <strong>L</strong>awful and <strong>F</strong>air?',
  '<strong>Stick to your licence class.</strong> Bronze can\'t pursue; only Gold/Silver can be primary in a pursuit. Abusing it gets it downgraded.',
  '<strong>Mandatory RBT/RDT.</strong> If you\'re charging any traffic offence, you must run a roadside breath &amp; drug test first.',
  '<strong>Search law matters.</strong> A frisk needs reasonable suspicion; a full search is only lawful when you\'re arresting the person.',
  'You\'re held to the highest standard <strong>on AND off duty</strong> — using police powers off duty is powergaming.',
  '<strong>If you\'re unsure, ask.</strong> Grab your FTO or a senior officer before you commit to something you can\'t take back.'
];

/* ── Radio-call scripts (read aloud in the guide accordion) ────────── */
const GUIDE_COPY = [
  {
    id: "caution", icon: "⚖️", label: "The Caution (read on arrest)",
    text:
      "[POI NAME], my name is [RANK & NAME] from Melbourne Police General Duties Division. " +
      "You are currently under arrest for [CHARGES & FINES].\n\n" +
      "You do not have to say or do anything you don't want to. Anything you say or do may be given in evidence. " +
      "You have the right to communicate with a friend or family member to make known your whereabouts, and you " +
      "have the right to communicate with legal representation, which will be financially covered by the State of Victoria. " +
      "Do you understand the caution I have given you today?\n\n" +
      "You have the right to have your case heard by a magistrate if one is available. Do you wish to accept your charges, or fight them in court?"
  },
  {
    id: "code4", icon: "🚓", label: "Traffic stop (Code 4) call",
    text: "[CALLSIGN] Code 4 with a [VEHICLE DESCRIPTION] going [LOCATION]. Additional required / not required."
  },
  {
    id: "enroute", icon: "📻", label: "Enroute call",
    text: "[CALLSIGN] enroute to [JOB], [DISTANCE] out. (Over 3km — add \"Delayed Response\".)"
  },
  {
    id: "pursuit", icon: "🏁", label: "Pursuit comms",
    text:
      "[CALLSIGN] in an active pursuit with [VEHICLE DESCRIPTION], [#] heads on board.\n" +
      "Licence Class [GOLD/SILVER], Vehicle Class [GOLD/SILVER].\n" +
      "Traffic is [LIGHT / MODERATE / HEAVY], weather is [CLEAR / FOGGY / RAINY].\n" +
      "Heading [DIRECTION] on [ROAD] towards [LANDMARK].\n" +
      "Right-right, continuing [DIRECTION] on [STREET NAME]."
  },
  {
    id: "search", icon: "🔎", label: "Pre-search declaration",
    text: "My name is [RANK & NAME], I'm going to be conducting a SEARCH / NON-INVASIVE PAT DOWN today. Do you have anything on you that could stick, stab or prod me? Anything you want to declare?"
  },
  {
    id: "breach", icon: "🚨", label: "Code 15 breach warnings",
    text:
      "Melbourne Police — if anyone is inside the building please make yourself known. (Repeat x2)\n\n" +
      "Melbourne Police — this is your third and final warning. If you do not come out with your hands up, we will breach."
  }
];

/* ── Quick-reference mini-tables (codes + priorities) ──────────────── */
const GUIDE_QUICKREF_HTML =
  '<div class="guide-ref-grid">' +
    '<div class="guide-ref"><strong>Radio codes</strong><br>' +
      'Code 0 — Disconnected / headpopped<br>' +
      'Code 1 — On patrol / available<br>' +
      'Code 2 — Arrived at station<br>' +
      'Code 3 — Meal break<br>' +
      'Code 4 — Traffic stop<br>' +
      'Code 5 — Arrived at scene / job<br>' +
      'Code 6 — Unavailable / busy<br>' +
      'Code 8 — Clocking off duty<br>' +
      '<strong style="color:var(--warn)">Code 9 — DURESS (officer in danger)</strong><br>' +
      'Code 10 — Domestic / public order<br>' +
      'Code 12 — Traffic crash / collision<br>' +
      'Code 15 — Silent alarm / robbery<br>' +
      'Code 16 — Collision, serious injuries' +
    '</div>' +
    '<div class="guide-ref"><strong>Priority levels</strong><br>' +
      '<strong>Priority 1</strong> — Lights &amp; sirens. Critical emergencies &amp; pursuits.<br>' +
      '<strong>Priority 2</strong> — Lights, sirens as necessary. Warning systems at crossings.<br>' +
      '<strong>Priority 3</strong> — No lights/sirens. Normal road rules.<br><br>' +
      '<strong>Licence classes</strong><br>' +
      'Gold — unrestricted, can pursue &amp; terminate.<br>' +
      'Silver — 250km/h, can be primary in a pursuit.<br>' +
      'Bronze — 200km/h, <em>cannot</em> pursue.' +
    '</div>' +
    '<div class="guide-ref"><strong>Callsign prefixes</strong><br>' +
      'MEL — Melbourne · MTT — Mt. Thomas<br>' +
      'VIN — Vinewood · GRP — Grapeseed<br>' +
      'K9 / POR — certified units only<br>' +
      '3xx — van/divvy · U — unmarked · P — pigeon' +
    '</div>' +
  '</div>';

/* ── "What radio comms are" explainer (guide page card) ────────────── */
const GUIDE_RADIO_HTML =
  '<h4>What the radio is for</h4>' +
  '<p>The radio is your <strong>in-character</strong> link to dispatch and every other unit. Everyone shares one channel, so treat it like a busy road — keep it clear, keep it short, and only key up when you actually have something to say.</p>' +

  '<h4>Stay professional — what does NOT go over radio</h4>' +
  '<ul>' +
    '<li><strong>No out-of-character / meta chatter.</strong> Jokes, arguments and OOC talk clog the channel.</li>' +
    '<li><strong>No powergaming intel</strong> — don\'t transmit things your character couldn\'t actually know.</li>' +
    '<li><strong>No personal abuse.</strong> You\'re the face of Melbourne Police on the radio too.</li>' +
    '<li><strong>Be clear:</strong> one thought per transmission, use radio <em>codes</em> and the phonetic alphabet, and say your callsign first.</li>' +
  '</ul>' +

  '<h4>When NOT to transmit</h4>' +
  '<p>During an <strong>active pursuit</strong>, a <strong>Code 15</strong> (robbery / hostage) or a <strong>Code 9</strong> (duress), stay <strong>off the primary channel</strong> unless you\'re adding something that genuinely helps. The officer running the job owns the channel — never talk over urgent traffic.</p>' +

  '<h4>Cutting in for something urgent — <span class="guide-break">BREAK BREAK BREAK</span></h4>' +
  '<p>If you have urgent/priority traffic while others are talking, key up with <strong>"BREAK BREAK BREAK"</strong>, then your callsign and the message. Everyone else clears the channel for you. Use it for real priorities only — a Code 9, shots fired, a unit needing immediate help — not to jump the queue.</p>' +

  '<h4>Getting to a job — the enroute call</h4>' +
  '<p>Call up as you start moving so dispatch knows who\'s coming and how far out you are. Over <strong>3&nbsp;km</strong>, add <strong>"Delayed Response"</strong>.</p>' +
  '<div class="guide-jump" style="margin-top:6px">' +
    '<button class="btn" type="button" data-guide-read="enroute">📻 Open the enroute call</button>' +
    '<button class="btn" type="button" data-guide-topic="radio-codes">📖 All radio codes</button>' +
  '</div>' +

  '<h4>Pursuits — opening line &amp; updates</h4>' +
  '<p><strong>Open smoothly.</strong> Lead with the <em>major</em> components, then fill in the minor ones as you can:</p>' +
  '<ul>' +
    '<li><strong>Major:</strong> your callsign · vehicle colour/type · location &amp; direction · speed.</li>' +
    '<li><strong>Minor:</strong> licence/vehicle class · weather · traffic.</li>' +
  '</ul>' +
  '<p><strong>Keep updates flowing.</strong> Call every change of road or direction — <em>"right-right onto [street]"</em>, <em>"left-left"</em> — plus speed and hazards, so backup and air support can slot in. Always pair a direction with the road name (e.g. <em>"westbound on [road]"</em>).</p>' +
  '<div class="guide-jump" style="margin-top:6px">' +
    '<button class="btn" type="button" data-guide-read="pursuit">🏁 Open pursuit comms</button>' +
    '<button class="btn" type="button" data-guide-topic="license-classes">📖 Licence classes</button>' +
    '<button class="btn" type="button" data-guide-topic="priority">📖 Priority levels</button>' +
  '</div>' +

  '<h4>Licence classes — the short version</h4>' +
  '<p><strong>Gold</strong> — unrestricted; can pursue and terminate anyone\'s pursuit. <strong>Silver</strong> — 250&nbsp;km/h; can be primary in a pursuit and terminate its own. <strong>Bronze</strong> — 200&nbsp;km/h; <em>cannot</em> pursue. Stick to your class — abusing it gets it downgraded.</p>' +

  '<h4>Terminating your OWN pursuit</h4>' +
  '<p>You can call off your own pursuit at any time — and you <strong>should</strong> the moment it becomes <strong>too dangerous</strong> (speed, traffic, weather) or you <strong>lose visual</strong> of the suspect vehicle. Call <em>"[CALLSIGN] terminating pursuit"</em> and give your last known location and direction of travel.</p>' +

  '<h4>Imperative pursuit</h4>' +
  '<p>An <strong>imperative pursuit</strong> is one that\'s justified to continue <em>despite</em> the risk, because letting the offender get away is more dangerous than the pursuit itself — e.g. an active threat to life. It still has to withstand scrutiny (the S.E.L.F test).</p>' +

  '<h4>Ping your location — the <span class="rh-pill">END</span> hotkey</h4>' +
  '<p>Press <span class="rh-pill">END</span> to drop/ping your current location so other units and air support can find you fast. Use it in pursuits and whenever you call for backup.</p>' +

  '<h4>Driving &amp; when you can break road rules</h4>' +
  '<p>Your <strong>priority level</strong> sets what you\'re allowed to do: <strong>Priority 1</strong> (lights &amp; sirens) — you may exceed the limit and break road rules for critical jobs &amp; pursuits; <strong>Priority 2</strong> — the same, but only <em>as necessary</em>, using warning systems at crossings; <strong>Priority 3</strong> — normal road rules. Whatever the priority, drive to the conditions, <strong>clear every intersection</strong>, and be ready to justify it.</p>' +

  '<div class="guide-verify"><strong>✎ Verify server rules:</strong> the exact wording/rules for <strong>imperative pursuit</strong>, the <span class="rh-pill">END</span> location ping, and when you <em>must</em> terminate a pursuit can differ between servers — double-check these three against your current BBRP / GD SOPs and tweak the wording.</div>';

/* ── Scenario walkthroughs ─────────────────────────────────────────── */
const GUIDE_SCENARIOS = [
  {
    id: "start-of-shift", icon: "🌅", label: "Start of shift",
    html:
      '<h3>Getting on the road</h3>' +
      '<div class="muted" style="margin-bottom:6px">Do these every shift before you call up available.</div>' +
      '<ol class="guide-steps">' +
        '<li><strong>Grab your loadout</strong> — Pistol + holster + 100 ammo, Taser, baton, flashlight, GSR test kit (x7), evidence bags, bandages, medkits (x2), fire extinguisher.</li>' +
        '<li><strong>Sign on the MDT</strong> — MDT &rarr; <em>Login Auto GD Callsign</em> &rarr; <em>s/v</em> &rarr; <em>MEL/MTT</em>. (Caged unit = <strong>v</strong>, anything else = <strong>s</strong>; CBD = <strong>MEL</strong>, Mt Thomas/Bendigo = <strong>MTT</strong>.) On a 2-up with an FTO, log the <em>exact</em> callsign, not Auto GD.</li>' +
        '<li><strong>Set up your radio</strong> — Channel 2 [VP PRIMARY], press <strong>E</strong> to turn it on, test PTT and do a radio check.</li>' +
        '<li><strong>Run your on-duty commands</strong> — <span class="rh-pill">/location</span> (location + direction on screen), <span class="rh-pill">/policeregister</span> (registers your car on radar), <span class="rh-pill">/police_callsign</span> (shows your callsign). Keybind them so you never forget in a pursuit.</li>' +
        '<li><strong>Check your measurements</strong> — Settings &rarr; General &rarr; Measurement System &rarr; <strong>Metric</strong>, so speeds read in km/h.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-topic="start-of-shift">📖 Full start-of-shift topic</button>' +
        '<button class="btn" type="button" data-guide-topic="commands">📖 Commands &amp; keybinds</button>' +
      '</div>'
  },
  {
    id: "traffic-stop", icon: "🚦", label: "Traffic stop (Code 4)",
    html:
      '<h3>Pulling someone over</h3>' +
      '<div class="muted" style="margin-bottom:6px">The minimum reason for a stop is an RBT/RDT — you don\'t need more than that.</div>' +
      '<ol class="guide-steps">' +
        '<li><strong>Call it up</strong> — use the Code 4 radio call (read it from <strong>Radio calls</strong> above) with the vehicle description and location.</li>' +
        '<li><strong>Approach and introduce yourself</strong> — rank, name, and why you\'ve stopped them.</li>' +
        '<li><strong>Mandatory RBT &amp; RDT</strong> — if you\'re going to charge <em>any</em> traffic offence, you must run a roadside breath test and drug test first. No exceptions.</li>' +
        '<li><strong>Decide the outcome:</strong> a <strong>PIN</strong> is a fine only (speeding, minor stuff); a <strong>charge</strong> is a criminal offence (dangerous/reckless driving, evade). Serious offences → arrest.</li>' +
        '<li><strong>Write it up</strong> — a fine/traffic matter goes in a Traffic Warrant; an arrest goes in an Arrest Report.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="traffic_warrant" style="background:var(--vp-accent-btn);border-color:var(--accent)">→ Start Traffic Warrant</button>' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="arrest">→ Start Arrest Report</button>' +
        '<button class="btn" type="button" data-guide-topic="rbt-rdt">📖 RBT/RDT rules</button>' +
      '</div>'
  },
  {
    id: "driver-fled", icon: "🏃", label: "Driver fled / failed to stop",
    html:
      '<h3>They failed to stop</h3>' +
      '<ol class="guide-steps">' +
        '<li><strong>Only pursue if your licence class allows it.</strong> Bronze — do not pursue. Note the rego, description and direction of travel.</li>' +
        '<li><strong>If you pursue</strong>, give clear pursuit comms (read the format from <strong>Radio calls</strong> above) and keep them updated.</li>' +
        '<li><strong>Run the plate</strong> to find the registered owner and check stolen status.</li>' +
      '</ol>' +
      '<div class="guide-q">Which warrant do I write? Ask yourself one question:</div>' +
      '<div class="muted" style="font-size:12px;margin-bottom:2px">Did you <strong>formally confirm the driver\'s identity</strong> (licence / ID / fingerprint) <strong>before</strong> they fled?</div>' +
      '<div class="muted" style="font-size:11px;margin-bottom:6px">Click the matching card to start that warrant:</div>' +
      '<div class="guide-decision">' +
        '<div class="guide-branch yes" role="button" tabindex="0" data-guide-jump="report" data-report-type="vicpol_arrest" data-id-status="CONFIRMED" aria-label="Start a Warrant for Arrest (ID confirmed)">' +
          '<h4>✅ YES → Warrant for Arrest</h4>' +
          '<p>You confirmed who was driving before they fled, so that person can be named for arrest. <span class="guide-id-flag">ID Confirmed</span> — record the confirmation basis on the warrant.</p>' +
          '<div class="guide-branch-cta">→ Start Warrant for Arrest</div>' +
        '</div>' +
        '<div class="guide-branch no" role="button" tabindex="0" data-guide-jump="report" data-report-type="vicpol_warrant" data-id-status="UNCONFIRMED" aria-label="Start a Warrant for Questioning (ID unconfirmed)">' +
          '<h4>❔ NO → Warrant for Questioning</h4>' +
          '<p>You never confirmed the driver, so no one can be arrested yet. Name the <strong>registered owner</strong> from the plate check (never a verbal name), <span class="guide-id-flag">ID Unconfirmed</span>, to bring them in for questioning.</p>' +
          '<div class="guide-branch-cta">→ Start Warrant for Questioning</div>' +
        '</div>' +
      '</div>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-topic="code4-flee">📖 Fled stop — which warrant?</button>' +
      '</div>'
  },
  {
    id: "making-arrest", icon: "🔒", label: "Making an arrest",
    html:
      '<h3>Arresting &amp; processing a suspect</h3>' +
      '<ol class="guide-steps">' +
        '<li><strong>State the threat before the force.</strong> Only use force that\'s proportionate — always able to be justified in the report.</li>' +
        '<li><strong>Cuff and search.</strong> A full search is lawful because you\'re arresting them. Note everything found.</li>' +
        '<li><strong>Read the caution</strong> word-for-word (read it from <strong>Radio calls</strong> above) and note whether they understood and accepted.</li>' +
        '<li><strong>Identify properly</strong> — licence, MDT profile, or fingerprints. State the method in the report.</li>' +
        '<li><strong>Process</strong> at the station: record charges vs PINs, sentence within the caps, and where they were processed/sentenced.</li>' +
        '<li><strong>Write the Arrest Report</strong> — court-ready, stands alone without your testimony.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="arrest" style="background:var(--vp-accent-btn);border-color:var(--accent)">→ Start Arrest Report</button>' +
        '<button class="btn" type="button" data-guide-topic="arrest-caution">📖 Arrest &amp; caution</button>' +
        '<button class="btn" type="button" data-guide-topic="sentencing">📖 Sentencing caps</button>' +
      '</div>'
  },
  {
    id: "search", icon: "🔎", label: "Search: frisk vs full",
    html:
      '<h3>When can I search?</h3>' +
      '<div class="guide-warn"><strong>Get this right.</strong> A frisk and a full search have different legal thresholds. Always give the pre-search declaration first (read it from <strong>Radio calls</strong> above).</div>' +
      '<div class="guide-decision">' +
        '<div class="guide-branch no">' +
          '<h4>🖐 Frisk (non-invasive pat down)</h4>' +
          '<p>Allowed when you have <strong>reasonable suspicion</strong> a crime has been committed or the person holds contraband. Used to investigate when you don\'t yet have enough to arrest. Refusing a frisk can escalate to a full search.</p>' +
        '</div>' +
        '<div class="guide-branch yes">' +
          '<h4>🔓 Full (police) search</h4>' +
          '<p>Only lawful when you\'re <strong>arresting</strong> the person — i.e. you witnessed the crime, there\'s evidence on scene, or they have an active warrant / FPO.</p>' +
        '</div>' +
      '</div>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="search_seizure" style="background:var(--vp-accent-btn);border-color:var(--accent)">→ Start Search &amp; Seizure</button>' +
        '<button class="btn" type="button" data-guide-topic="search-seizure">📖 Search &amp; seizure</button>' +
      '</div>'
  },
  {
    id: "impound", icon: "🔧", label: "Impound / hoon driving",
    html:
      '<h3>Impounding a vehicle</h3>' +
      '<div class="muted" style="margin-bottom:6px">Most impounds run off the anti-hoon laws — the offence number sets the duration and fine.</div>' +
      '<ol class="guide-steps">' +
        '<li><strong>Confirm it\'s an impoundable offence</strong> (excessive speed, dangerous/reckless driving, evade, etc.).</li>' +
        '<li><strong>Pick the offence number</strong> in the Traffic Warrant — it auto-fills the duration and fine from the impound schedule (#1 = 12h/$6,500 … escalating to #12 = crush).</li>' +
        '<li><strong>Higher tiers need rank.</strong> #1–#5 = LSC+, #6+ = SGT+. Record the approver.</li>' +
        '<li><strong>Log the vehicle</strong> — rego, make, colour, and where it was towed.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="traffic_warrant" style="background:var(--vp-accent-btn);border-color:var(--accent)">→ Start Traffic Warrant</button>' +
        '<button class="btn" type="button" data-guide-topic="impounds">📖 Impound schedule</button>' +
      '</div>'
  },
  {
    id: "welfare", icon: "🤝", label: "Welfare / community contact",
    html:
      '<h3>Non-offence interactions</h3>' +
      '<div class="muted" style="margin-bottom:6px">Welfare checks, move-on orders, community engagement — no charges attached, but still worth a record.</div>' +
      '<ol class="guide-steps">' +
        '<li><strong>Be helpful, respectful and professional</strong> — you\'re the face of Melbourne Police.</li>' +
        '<li><strong>Note who, when and where</strong> — person, time, location and the type of contact.</li>' +
        '<li><strong>Summarise what happened</strong> and any action taken (e.g. a move-on order given).</li>' +
        '<li><strong>Log it as a Field Contact</strong> so there\'s a record without creating an offence.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="field_contact" style="background:var(--vp-accent-btn);border-color:var(--accent)">→ Start Field Contact</button>' +
        '<button class="btn" type="button" data-guide-topic="warrants">📖 Move-on orders &amp; reports</button>' +
      '</div>'
  },
  {
    id: "code15", icon: "🚨", label: "Code 15 / critical incident",
    html:
      '<h3>Robbery / hostage situation</h3>' +
      '<div class="guide-warn"><strong>Stay off the primary channel unless you have something to add.</strong> Scene Command runs the incident — follow directions.</div>' +
      '<div class="guide-q">The three roles:</div>' +
      '<div class="guide-ref-grid" style="margin:4px 0 10px">' +
        '<div class="guide-ref"><strong>Scene Command (SC)</strong><br>Makes all decisions on scene, co-ordinates units, approves demands.</div>' +
        '<div class="guide-ref"><strong>Negotiator</strong><br>Communicates with the offenders for demands, relays everything to SC.</div>' +
        '<div class="guide-ref"><strong>Additional units</strong><br>Keep a secure perimeter, listen to directions, stand by for a possible breach.</div>' +
      '</div>' +
      '<ol class="guide-steps">' +
        '<li><strong>Gather intel</strong> — number of hostages/takers, weapons, demands, direction of travel &amp; ETA.</li>' +
        '<li><strong>Give the breach warnings</strong> (read them from <strong>Radio calls</strong> above) before any entry.</li>' +
        '<li><strong>Breach ratio</strong> — non-lethal to lethal must be <strong>2:1</strong>. Order of stack: Non-Lethal, Lethal, Non-Lethal.</li>' +
        '<li><strong>Once clear</strong>, detain everyone, render first aid, and write it up as an Arrest Report.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-topic="critical-incidents">📖 Critical incidents</button>' +
        '<button class="btn" type="button" data-guide-topic="use-of-force">📖 Use of force</button>' +
      '</div>'
  },
  {
    id: "gang-scene", icon: "🩹", label: "Gang violence / mass-casualty scene",
    html:
      '<h3>Multiple down after gang / crew violence</h3>' +
      '<div class="guide-warn"><strong>Medical before weapons.</strong> Render aid first. Do not confiscate weapons before treating &amp; processing — only ID may be taken before treatment is done.</div>' +
      '<div class="guide-q">Work it in this order:</div>' +
      '<ol class="guide-steps">' +
        '<li><strong>Render medical aid</strong> to the injured. Nothing taken except ID until they are stabilised.</li>' +
        '<li><strong>Once stable</strong>, help them up and say what happens next — GSR, find ID, search — so they know your intentions.</li>' +
        '<li><strong>Secure items</strong> — request CIRT to confiscate firearms / illegal items, or take them yourself.</li>' +
        '<li><strong>No ID?</strong> Request a CSO to the scene, or wait until the station. No F6 prints unless at a station or deployed as CSO.</li>' +
        '<li><strong>Process</strong> — cuff, read the caution, then standard custody.</li>' +
      '</ol>' +
      '<div class="guide-jump">' +
        '<button class="btn" type="button" data-guide-topic="scene-processing">📖 Scene processing order</button>' +
        '<button class="btn" type="button" data-guide-topic="use-of-force">📖 Use of force</button>' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="arrest">📝 Start Arrest Report</button>' +
        '<button class="btn" type="button" data-guide-jump="report" data-report-type="search_seizure">📝 Search &amp; Seizure</button>' +
      '</div>'
  }
];

if (typeof window !== "undefined") {
  window.GUIDE_GOLDEN_RULES = GUIDE_GOLDEN_RULES;
  window.GUIDE_COPY = GUIDE_COPY;
  window.GUIDE_QUICKREF_HTML = GUIDE_QUICKREF_HTML;
  window.GUIDE_RADIO_HTML = GUIDE_RADIO_HTML;
  window.GUIDE_SCENARIOS = GUIDE_SCENARIOS;
}
