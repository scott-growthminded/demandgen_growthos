import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { ArrowLeft } from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  themeVariables: {
    primaryColor: "#FFF0ED",
    primaryBorderColor: "#FF502D",
    primaryTextColor: "#1a1a1a",
    lineColor: "#FF502D",
    secondaryColor: "#f9f9f9",
    tertiaryColor: "#fff",
  },
});

const diagrams = [
  {
    title: "Main Booking Flow",
    description:
      "The complete path from location selection through confirmation, branching based on phone number patterns.",
    code: `flowchart TD
    A[Location Selection] --> B[Phone Verification]
    B --> C{Phone Number Pattern}

    C -->|All 1s - Lead| D[Personal Info]
    C -->|All 2s - Non-member| E[OTP Verification]
    C -->|All 3s - Member| E
    C -->|All 4s - First-time Member| E

    D --> F[Product Selection]
    E --> F

    F --> G{Product Type?}

    G -->|Treatment| H[Date & Time Selection]
    G -->|Gift Card| I[Gift Recipient Info]
    G -->|Membership / Package| J[Checkout]

    H --> J
    I --> J

    J --> K[Confirmation]`,
  },
  {
    title: "User Type Branching",
    description:
      "How each user type flows through different steps with unique behaviors.",
    code: `flowchart TD
    PV[Phone Verification] --> |Identify User| UT{User Type}

    UT -->|Lead: 0 visits| LEAD[Lead Flow]
    UT -->|Non-member: 1+ visits| NM[Non-member Flow]
    UT -->|Member: returning| MEM[Member Flow]
    UT -->|Member: first-time, 0 visits| MEM0[First-time Member Flow]

    LEAD --> PI[Personal Info Form]
    PI --> PS1[Product Selection]
    PS1 --> |Shows membership upsell|PS1

    NM --> OTP1[OTP Verification]
    OTP1 --> PS2[Product Selection]
    PS2 --> |Shows membership upsell, $80 pricing|PS2

    MEM --> OTP2[OTP Verification]
    OTP2 --> PS3[Product Selection]
    PS3 --> |Uses vouchers|PS3

    MEM0 --> OTP3[OTP Verification]
    OTP3 --> PS4[Product Selection]
    PS4 --> |Shows 17-and-under options|PS4`,
  },
  {
    title: "Treatment Selection Logic",
    description:
      "Product type branching, location-based treatment duration, and user-type-specific pricing.",
    code: `flowchart TD
    PS[Product Selection] --> TYP{Product Type?}

    TYP -->|Facial Treatment| LOC{Location?}
    TYP -->|Gift Card| GC[Gift Recipient Info] --> CO[Checkout]
    TYP -->|Membership| CO
    TYP -->|Package| CO

    LOC -->|Murray Hill| MH[40-min treatment duration]
    LOC -->|All Other Locations| OL[30-min treatment duration]

    MH --> UT2{User Type?}
    OL --> UT2

    UT2 -->|Lead, 0 visits| T1[First-time facial - $80]
    UT2 -->|Non-member, 1+ visits| T2[Returning facial - $80]
    UT2 -->|Member, 0 visits| T3[17-and-under options shown]
    UT2 -->|Member, 1+ visits| T4[Use voucher for treatment]

    T1 --> DT[Date & Time Selection]
    T2 --> DT
    T3 --> DT
    T4 --> DT

    DT --> CO`,
  },
  {
    title: "Backend Architecture",
    description:
      "Frontend/backend/Boulevard API relationships including GraphQL connections and webhook handling.",
    code: `flowchart LR
    subgraph Frontend
        BW[Booking Widget]
        TQ[TanStack Query Cache]
        BW <--> TQ
    end

    subgraph Backend
        EX[Express Server]
        BS[BlvdService]
        MS[In-Memory Storage]
        EX --> BS
        EX --> MS
    end

    subgraph Boulevard_APIs
        ADMIN[Admin GraphQL API]
        CLIENT[Client GraphQL API]
        WH[Webhooks]
    end

    TQ <-->|REST API| EX
    BS <-->|GraphQL| ADMIN
    BS <-->|GraphQL| CLIENT
    WH -->|HMAC-SHA256| EX`,
  },
  {
    title: "Cart Lifecycle",
    description:
      "Typical cart progression through Boulevard's Client API. Additional GET endpoints exist for browsing dates/times before reserving.",
    code: `flowchart TD
    S((Start)) --> C[Create Cart]
    C -->|POST create| AI[Add Items]
    AI -->|POST add-item| BR[Browse Dates & Times]
    BR -->|GET dates, GET times| RT[Reserve Time]
    RT -->|POST reserve| CI[Collect Client Info]
    CI -->|POST client-info| AP[Add Payment]
    AP -->|POST payment| CO[Checkout]
    CO -->|POST checkout| E((Done))`,
  },
];

function MermaidDiagram({ code, id }: { code: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    const render = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${id}`,
          code
        );
        setSvg(renderedSvg);
      } catch (e) {
        console.error("Mermaid render error:", e);
      }
    };
    render();
  }, [code, id]);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto bg-white rounded-xl border border-gray-200 p-6"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 px-6 py-4 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Booking
          </a>
          <h1
            className="text-xl font-bold"
            style={{ color: "#FF502D" }}
            data-testid="text-docs-title"
          >
            Glowbar Booking Flow Documentation
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {diagrams.map((diagram, index) => (
          <section key={index} data-testid={`section-diagram-${index}`}>
            <h2
              className="text-2xl font-bold mb-2"
              data-testid={`text-diagram-title-${index}`}
            >
              {diagram.title}
            </h2>
            <p
              className="text-gray-600 mb-4"
              data-testid={`text-diagram-desc-${index}`}
            >
              {diagram.description}
            </p>
            <MermaidDiagram code={diagram.code} id={`diagram-${index}`} />
          </section>
        ))}

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2
            className="text-xl font-bold mb-3"
            data-testid="text-legacy-title"
          >
            Legacy Flow (still in code)
          </h2>
          <p className="text-gray-600" data-testid="text-legacy-desc">
            The following steps exist in the codebase but are not used by the
            current phone verification flow:
          </p>
          <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
            <li>
              <strong>customer-type</strong>: New vs returning customer
              selection, leads to product (new) or login (returning)
            </li>
            <li>
              <strong>login</strong>: Email/password login, leads to product
              selection
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
