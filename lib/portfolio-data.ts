export const TRUST_STATS = [
  { value: "500+", label: "Projects Delivered" },
  { value: "15M+", label: "Sq Ft Designed" },
  { value: "200+", label: "Happy Clients" },
  { value: "50+", label: "Cities Pan India" },
]

export type Project = {
  id: string
  sectorId: string
  title: string
  client: string
  city: string
  areaSqft: string
  scope: string
  year: string
  images: string[]
  highlight: string
}

export type Sector = {
  id: string
  label: string
  shortLabel: string
  heroHeadline: string
  heroSub: string
  accentColor: string
  gradientFrom: string
  services: string[]
  projects: Project[]
  portfolioPdf: string
  pdfLabel: string
}

export const SECTORS: Sector[] = [
  {
    id: "office_interiors",
    label: "Office Interiors",
    shortLabel: "Offices",
    heroHeadline: "500+ Workspaces Delivered Across India",
    heroSub: "From concept to handover - turnkey office interiors for corporates, MNCs, and startups",
    accentColor: "#3B82F6",
    gradientFrom: "rgba(59,130,246,0.15)",
    services: [
      "Space Planning & Design",
      "False Ceiling & Flooring",
      "Glass Partition Systems",
      "Furniture & Workstations",
      "Lighting Design",
      "MEP Integration",
    ],
    projects: [
      {
        id: "oi-theon",
        sectorId: "office_interiors",
        title: "Theon Office Fitout",
        client: "Theon",
        city: "Noida",
        areaSqft: "TBD",
        scope: "Design & Build",
        year: "2024",
        images: [
          "/portfolio/office-interiors/theon/1.jpg",
          "/portfolio/office-interiors/theon/2.jpg",
          "/portfolio/office-interiors/theon/3.jpg",
          "/portfolio/office-interiors/theon/4.jpg",
          "/portfolio/office-interiors/theon/5.jpg",
          "/portfolio/office-interiors/theon/6.jpg",
          "/portfolio/office-interiors/theon/7.jpg",
          "/portfolio/office-interiors/theon/8.jpg",
          "/portfolio/office-interiors/theon/9.jpg",
        ],
        highlight: "Turnkey delivery",
      },
      {
        id: "oi-msc",
        sectorId: "office_interiors",
        title: "MSC Office Fitout",
        client: "MSC",
        city: "TBD",
        areaSqft: "TBD",
        scope: "Design & Build",
        year: "2023",
        images: [
          "/portfolio/office-interiors/msc/1.jpg",
          "/portfolio/office-interiors/msc/2.jpg",
          "/portfolio/office-interiors/msc/3.jpg",
          "/portfolio/office-interiors/msc/5.jpg",
          "/portfolio/office-interiors/msc/6.jpg",
        ],
        highlight: "On-time delivery",
      },
      {
        id: "oi-oceaneering",
        sectorId: "office_interiors",
        title: "Oceaneering Office Fitout",
        client: "Oceaneering",
        city: "Noida",
        areaSqft: "TBD",
        scope: "Design & Build",
        year: "2024",
        images: [
          "/portfolio/office-interiors/oceaneering/1.jpeg",
          "/portfolio/office-interiors/oceaneering/2.jpeg",
          "/portfolio/office-interiors/oceaneering/3.jpeg",
          "/portfolio/office-interiors/oceaneering/4.jpeg",
          "/portfolio/office-interiors/oceaneering/5.jpeg",
        ],
        highlight: "Premium fitout",
      },
    ],
    portfolioPdf: "/portfolio/pdfs/office-interiors.pdf",
    pdfLabel: "Office Interiors Portfolio",
  },
  {
    id: "mep",
    label: "MEP Services",
    shortLabel: "MEP",
    heroHeadline: "End-to-End MEP Solutions for Commercial Spaces",
    heroSub: "Mechanical, Electrical & Plumbing - engineered for performance and compliance",
    accentColor: "#F59E0B",
    gradientFrom: "rgba(245,158,11,0.15)",
    services: [
      "HVAC Design & Installation",
      "Electrical Systems & LV",
      "Plumbing & Sanitary",
      "Fire Fighting Systems",
      "BMS & Automation",
      "Energy Audits",
    ],
    projects: [
      {
        id: "mep-1",
        sectorId: "mep",
        title: "Fire Pump & Valve System",
        client: "Real Estate Developer",
        city: "Bengaluru",
        areaSqft: "1,20,000",
        scope: "MEP Full Scope",
        year: "2024",
        images: [
          "/portfolio/mep/project-1/1.png",
          "/portfolio/mep/project-1/2.png",
          "/portfolio/mep/project-1/3.png",
          "/portfolio/mep/project-1/4.png",
        ],
        highlight: "30% energy saving",
      },
      {
        id: "mep-2",
        sectorId: "mep",
        title: "Power Distribution Panel",
        client: "Commercial Project",
        city: "Delhi NCR",
        areaSqft: "TBD",
        scope: "Electrical Systems & LV",
        year: "2024",
        images: [
          "/portfolio/mep/project-2/1.png",
          "/portfolio/mep/project-2/2.png",
          "/portfolio/mep/project-2/3.png",
        ],
        highlight: "Compliant LT panel build",
      },
      {
        id: "mep-3",
        sectorId: "mep",
        title: "Commercial HVAC & Pipeline Network",
        client: "Commercial Project",
        city: "Delhi NCR",
        areaSqft: "TBD",
        scope: "HVAC Design & Installation",
        year: "2024",
        images: [
          "/portfolio/mep/project-3/1.png",
          "/portfolio/mep/project-3/2.png",
          "/portfolio/mep/project-3/3.png",
          "/portfolio/mep/project-3/4.png",
        ],
        highlight: "End-to-end HVAC & piping",
      },
    ],
    portfolioPdf: "/portfolio/pdfs/mep.pdf",
    pdfLabel: "MEP Services Portfolio",
  },
  {
    id: "facade_glazing",
    label: "Facade & Glazing",
    shortLabel: "Facade",
    heroHeadline: "High-Performance Facades That Define Buildings",
    heroSub: "Unitised, semi-unitised and stick systems - from engineering to on-site installation",
    accentColor: "#8B5CF6",
    gradientFrom: "rgba(139,92,246,0.15)",
    services: [
      "Unitised Curtain Wall",
      "Structural Glazing",
      "ACP Cladding",
      "Spider Glazing",
      "Skylights & Atriums",
      "Facade Maintenance Systems",
    ],
    projects: [
      {
        id: "fg-dlf-building-8",
        sectorId: "facade_glazing",
        title: "DLF Building 8",
        client: "DLF · IT Space",
        city: "Cyber City, Gurgaon",
        areaSqft: "14,175 SQM",
        scope:
          "Stick Curtain Wall Glazing, Aluminium Solid Sheet, Galvalume & Shera Board Cladding",
        year: "2024",
        images: ["/portfolio/facade-glazing/project-DLF-Building-8/1.png"],
        highlight: "Stick curtain wall + cladding",
      },
      {
        id: "fg-anygraphics-factory",
        sectorId: "facade_glazing",
        title: "Anygraphics Factory",
        client: "Anygraphics · Industrial Facility",
        city: "Noida",
        areaSqft: "6,500 SQM",
        scope:
          "PIR Panel, Rock Wool Panel, Semi-Unitised Structural Glazing",
        year: "2024",
        images: ["/portfolio/facade-glazing/project-AnygraphicsFactory/1.png"],
        highlight: "Insulated panel envelope",
      },
      {
        id: "fg-adani-samsara-vilasa",
        sectorId: "facade_glazing",
        title: "Adani Samsara Vilasa",
        client: "Adani · High-End Residence",
        city: "Sector-60, Gurgaon",
        areaSqft: "6,398 SQM",
        scope: "Imported Aluminium Doors & Windows",
        year: "2024",
        images: [
          "/portfolio/facade-glazing/project-AdaniSamsara%20Vilasa/1.png",
        ],
        highlight: "Imported aluminium systems",
      },
      {
        id: "fg-broadway-service-apartment",
        sectorId: "facade_glazing",
        title: "Broadway Service Apartment",
        client: "Broadway · Service Apartments",
        city: "Dwarka Expy, Sector 83, Gurugram",
        areaSqft: "10,550 SQM",
        scope: "Curtain Wall Glazing & Aluminium Doors & Windows",
        year: "2024",
        images: [
          "/portfolio/facade-glazing/project-Broadway%20Service%20Apartment/1.png",
        ],
        highlight: "Curtain wall + DGU windows",
      },
      {
        id: "fg-rajiv-gandhi-airport",
        sectorId: "facade_glazing",
        title: "Rajiv Gandhi International Airport",
        client: "Airport Authority · Aviation",
        city: "Shamshabad, Hyderabad",
        areaSqft: "17,000 SQM",
        scope: "ACP Cladding, SS Cladding",
        year: "2024",
        images: [
          "/portfolio/facade-glazing/project-Rajiv%20Gandhi%20International%20Airport/1.png",
        ],
        highlight: "Airport-grade cladding",
      },
      {
        id: "fg-krisumi-waterfall",
        sectorId: "facade_glazing",
        title: "Krisumi Waterfall Residences",
        client: "Krisumi · High-End Residence",
        city: "Sector-36A, Gurgaon",
        areaSqft: "13,871 SQM + 7,107 RM",
        scope: "Imported Aluminium Doors & Windows + SS Railing",
        year: "2024",
        images: [
          "/portfolio/facade-glazing/project-KrisumiWaterfall%20Residences/1.png",
        ],
        highlight: "Aluminium + SS railings",
      },
      {
        id: "fg-dlf-we-work",
        sectorId: "facade_glazing",
        title: "DLF · WeWork",
        client: "DLF · IT Space",
        city: "Cyber City, Gurgaon",
        areaSqft: "3,325 SQM",
        scope: "Kingspan Dry Cladding Ventilated System",
        year: "2024",
        images: ["/portfolio/facade-glazing/project-DLF-We%20Work/1.png"],
        highlight: "Ventilated dry cladding",
      },
    ],
    portfolioPdf: "/portfolio/pdfs/facade-glazing.pdf",
    pdfLabel: "Facade & Glazing Portfolio",
  },
  {
    id: "peb_construction",
    label: "PEB",
    shortLabel: "PEB",
    heroHeadline: "Pre-Engineered Buildings - Fast, Strong, Cost-Efficient",
    heroSub: "Factory to site - PEB structures for warehouses, factories, and industrial facilities",
    accentColor: "#EF4444",
    gradientFrom: "rgba(239,68,68,0.15)",
    services: [
      "PEB Design & Engineering",
      "Structural Fabrication",
      "Erection & Installation",
      "Mezzanine Floors",
      "Roofing Systems",
      "Industrial Civil Works",
    ],
    projects: [
      {
        id: "peb-industrial-infrastructure",
        sectorId: "peb_construction",
        title: "Industrial Infrastructure",
        client: "Industrial Project",
        city: "Pan-India",
        areaSqft: "TBD",
        scope: "PEB Design & Build",
        year: "2024",
        images: [
          "/portfolio/peb-construction/Industrial%20Infrastructure/1.png",
          "/portfolio/peb-construction/Industrial%20Infrastructure/2.png",
          "/portfolio/peb-construction/Industrial%20Infrastructure/3.png",
        ],
        highlight: "Engineered for heavy-duty use",
      },
      {
        id: "peb-modern-warehouse-facility",
        sectorId: "peb_construction",
        title: "Modern Warehouse Facility",
        client: "Logistics & Warehousing",
        city: "Pan-India",
        areaSqft: "TBD",
        scope: "PEB Design & Build",
        year: "2024",
        images: [
          "/portfolio/peb-construction/Modern%20Warehouse%20Facility/1.png",
          "/portfolio/peb-construction/Modern%20Warehouse%20Facility/2.png",
          "/portfolio/peb-construction/Modern%20Warehouse%20Facility/3.png",
          "/portfolio/peb-construction/Modern%20Warehouse%20Facility/4.png",
        ],
        highlight: "Fast-track turnkey delivery",
      },
    ],
    portfolioPdf: "/portfolio/pdfs/peb.pdf",
    pdfLabel: "PEB Portfolio",
  },
  {
    id: "hospitality",
    label: "Hospitality",
    shortLabel: "Hotels",
    heroHeadline: "Spaces That Create Experiences Guests Remember",
    heroSub: "Hotels, restaurants, resorts - designed to delight and built to perform",
    accentColor: "#EC4899",
    gradientFrom: "rgba(236,72,153,0.15)",
    services: [
      "Hotel Lobby & Rooms",
      "Restaurant & F&B Spaces",
      "Resort & Spa Design",
      "Club & Lounge Interiors",
      "Banquet Halls",
      "Back-of-House Planning",
    ],
    projects: [
      {
        id: "hosp-taj-varanasi",
        sectorId: "hospitality",
        title: "Taj Hotel Varanasi",
        client: "Taj Hotels · Luxury Hospitality",
        city: "Varanasi",
        areaSqft: "TBD",
        scope: "Hotel Interior Fitout",
        year: "2024",
        images: [
          "/portfolio/hospitality/Taj%20Hotel%20Varanasi/1.png",
          "/portfolio/hospitality/Taj%20Hotel%20Varanasi/2.png",
          "/portfolio/hospitality/Taj%20Hotel%20Varanasi/3.png",
          "/portfolio/hospitality/Taj%20Hotel%20Varanasi/4.png",
        ],
        highlight: "Luxury heritage property",
      },
      {
        id: "hosp-paras-gwal-padi",
        sectorId: "hospitality",
        title: "Paras Gwal Padi",
        client: "Paras Hospitality",
        city: "Pan-India",
        areaSqft: "TBD",
        scope: "Hospitality Design & Build",
        year: "2024",
        images: [
          "/portfolio/hospitality/Paras%20Gwal%20Padi/1.png",
          "/portfolio/hospitality/Paras%20Gwal%20Padi/2.png",
          "/portfolio/hospitality/Paras%20Gwal%20Padi/3.png",
          "/portfolio/hospitality/Paras%20Gwal%20Padi/4.png",
          "/portfolio/hospitality/Paras%20Gwal%20Padi/5.png",
        ],
        highlight: "Full-scope fitout",
      },
      {
        id: "hosp-eloft",
        sectorId: "hospitality",
        title: "Eloft",
        client: "Eloft · Boutique Hospitality",
        city: "Pan-India",
        areaSqft: "TBD",
        scope: "Boutique Hotel Interiors",
        year: "2024",
        images: ["/portfolio/hospitality/Eloft/1.png"],
        highlight: "Boutique hotel experience",
      },
    ],
    portfolioPdf: "/portfolio/pdfs/hospitality.pdf",
    pdfLabel: "Hospitality Portfolio",
  },
]

export const TESTIMONIALS = [
  {
    quote: "Hagerstone delivered our 45,000 sq ft Noida office on time and within budget. The quality of finish and attention to detail was exceptional - our employees love the space.",
    name: "Rajesh Mehta",
    designation: "VP Administration",
    company: "Leading NBFC",
    sectorId: "office_interiors",
  },
  {
    quote: "Their MEP team is thorough. Every system was commissioned properly and we had zero snags post-handover. That is genuinely rare in this industry.",
    name: "Priya Nair",
    designation: "Head of Facilities",
    company: "Corporate Client, Bengaluru",
    sectorId: "mep",
  },
  {
    quote: "The facade work on our commercial complex was completed ahead of schedule. Hagerstone's site management and execution quality is top class.",
    name: "Amit Sharma",
    designation: "Director",
    company: "Real Estate Developer, Delhi",
    sectorId: "facade_glazing",
  },
]

export const PROCESS_STEPS = [
  { number: "01", title: "Site Survey & Brief", description: "We visit your site and understand your exact requirements, constraints, and vision" },
  { number: "02", title: "Concept Design", description: "3D visualisation and design approval before a single rupee is spent on execution" },
  { number: "03", title: "BOQ & Pricing", description: "Transparent itemised quote. No hidden costs, no surprises at handover" },
  { number: "04", title: "Execution", description: "On-site construction with a dedicated project manager as your single point of contact" },
  { number: "05", title: "Snag-Free Handover", description: "Full documentation, warranty certificates, and 1-year defect liability period" },
]

export const WHY_US = [
  { icon: "🏗️", title: "Single Vendor", description: "Interior + MEP + Facade + PEB under one roof. No coordination chaos." },
  { icon: "🏆", title: "ISO 9001:2015", description: "Quality management systems certified. Every process documented." },
  { icon: "📍", title: "Pan-India Execution", description: "500+ projects delivered across 50+ cities in India." },
  { icon: "⏱️", title: "On-Time Delivery", description: "95% of projects delivered on the agreed schedule." },
  { icon: "📋", title: "Transparent Pricing", description: "Itemised BOQ. You know exactly what you're paying for." },
  { icon: "🔒", title: "Post-Handover Support", description: "1-year defect liability. We stand behind our work." },
]
