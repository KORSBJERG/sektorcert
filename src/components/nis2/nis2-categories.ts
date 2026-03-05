export interface NIS2CategoryItem {
  id: string;
  text: string;
  status: "not_started" | "in_progress" | "implemented" | "not_applicable";
  notes: string;
}

export interface NIS2Category {
  id: string;
  title: string;
  description: string;
  icon: string;
  items: NIS2CategoryItem[];
}

export const DEFAULT_NIS2_CATEGORIES: NIS2Category[] = [
  {
    id: "governance",
    title: "Governance & Risikostyring",
    description: "Ledelsesansvar, politikker og risikostyringsprocesser",
    icon: "building",
    items: [
      { id: "gov-1", text: "Informationssikkerhedspolitik er vedtaget og godkendt af ledelsen", status: "not_started", notes: "" },
      { id: "gov-2", text: "Risikovurdering gennemføres mindst årligt", status: "not_started", notes: "" },
      { id: "gov-3", text: "Roller og ansvar for cybersikkerhed er tydeligt defineret", status: "not_started", notes: "" },
      { id: "gov-4", text: "Ledelsen deltager aktivt i sikkerhedsarbejdet", status: "not_started", notes: "" },
    ],
  },
  {
    id: "incident",
    title: "Incident Håndtering",
    description: "Processer for opdagelse, rapportering og håndtering af sikkerhedshændelser",
    icon: "alert",
    items: [
      { id: "inc-1", text: "Incident response plan er dokumenteret og testet", status: "not_started", notes: "" },
      { id: "inc-2", text: "Sikkerhedshændelser rapporteres inden for 24 timer", status: "not_started", notes: "" },
      { id: "inc-3", text: "Logning og overvågning af kritiske systemer er implementeret", status: "not_started", notes: "" },
      { id: "inc-4", text: "Kontaktoplysninger til CSIRT/myndigheder er opdaterede", status: "not_started", notes: "" },
    ],
  },
  {
    id: "continuity",
    title: "Business Continuity",
    description: "Forretningskontinuitet og disaster recovery",
    icon: "refresh",
    items: [
      { id: "bc-1", text: "Business continuity plan er dokumenteret", status: "not_started", notes: "" },
      { id: "bc-2", text: "Disaster recovery plan er testet inden for det seneste år", status: "not_started", notes: "" },
      { id: "bc-3", text: "Backup-strategi inkluderer offline/immutable backups", status: "not_started", notes: "" },
      { id: "bc-4", text: "Recovery Time Objective (RTO) er defineret for kritiske systemer", status: "not_started", notes: "" },
    ],
  },
  {
    id: "supply_chain",
    title: "Leverandørsikkerhed",
    description: "Sikkerhed i forsyningskæden og tredjepartsstyring",
    icon: "link",
    items: [
      { id: "sc-1", text: "Kritiske leverandører er identificeret og risikovurderet", status: "not_started", notes: "" },
      { id: "sc-2", text: "Sikkerhedskrav er inkluderet i leverandørkontrakter", status: "not_started", notes: "" },
      { id: "sc-3", text: "Leverandørers sikkerhedsstatus monitoreres løbende", status: "not_started", notes: "" },
    ],
  },
  {
    id: "network",
    title: "Netværks- & Informationssikkerhed",
    description: "Beskyttelse af netværk, systemer og data",
    icon: "network",
    items: [
      { id: "net-1", text: "Netværkssegmentering er implementeret", status: "not_started", notes: "" },
      { id: "net-2", text: "Firewall og IDS/IPS er konfigureret og overvåget", status: "not_started", notes: "" },
      { id: "net-3", text: "Kryptering af data in transit og at rest", status: "not_started", notes: "" },
      { id: "net-4", text: "Endpoint-beskyttelse er installeret på alle enheder", status: "not_started", notes: "" },
    ],
  },
  {
    id: "vulnerability",
    title: "Sårbarhedshåndtering",
    description: "Identifikation og håndtering af sårbarheder",
    icon: "search",
    items: [
      { id: "vul-1", text: "Sårbarhedsscanning gennemføres regelmæssigt", status: "not_started", notes: "" },
      { id: "vul-2", text: "Patches installeres inden for defineret tidsramme", status: "not_started", notes: "" },
      { id: "vul-3", text: "Asset inventory er opdateret og vedligeholdt", status: "not_started", notes: "" },
    ],
  },
  {
    id: "access",
    title: "Adgangskontrol",
    description: "Styring af adgang til systemer og data",
    icon: "lock",
    items: [
      { id: "acc-1", text: "MFA er aktiveret for alle brugere", status: "not_started", notes: "" },
      { id: "acc-2", text: "Princippet om mindste privilegium følges", status: "not_started", notes: "" },
      { id: "acc-3", text: "Adgangsrettigheder gennemgås minimum kvartalsvis", status: "not_started", notes: "" },
      { id: "acc-4", text: "Privilegerede konti administreres via PAM-løsning", status: "not_started", notes: "" },
    ],
  },
  {
    id: "hr_awareness",
    title: "HR-sikkerhed & Awareness",
    description: "Medarbejdersikkerhed og awareness-træning",
    icon: "users",
    items: [
      { id: "hr-1", text: "Security awareness-træning gennemføres årligt", status: "not_started", notes: "" },
      { id: "hr-2", text: "Phishing-simulationer gennemføres regelmæssigt", status: "not_started", notes: "" },
      { id: "hr-3", text: "On/offboarding-processer inkluderer sikkerhedsprocedurer", status: "not_started", notes: "" },
    ],
  },
  {
    id: "crypto",
    title: "Kryptografi",
    description: "Brug af kryptering og nøglehåndtering",
    icon: "key",
    items: [
      { id: "cry-1", text: "Krypteringspolitik er defineret og implementeret", status: "not_started", notes: "" },
      { id: "cry-2", text: "Nøglehåndtering følger anerkendte standarder", status: "not_started", notes: "" },
      { id: "cry-3", text: "TLS 1.2+ anvendes for alle eksterne forbindelser", status: "not_started", notes: "" },
    ],
  },
];
