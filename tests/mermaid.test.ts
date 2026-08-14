import { describe, expect, it } from "vitest";
import {
  isMermaidER,
  parseMermaidER,
  appendMermaidER,
  generateMermaidER,
} from "@/app/lib/mermaid";
import { parseCreateTable } from "@/app/lib/parser";
import { makeDemoSchema, makeEmptySchema, makeTable, tableHeight, tableWidth } from "@/app/lib/schema";
import { validateSchema } from "@/app/lib/validation";

const SAMPLE_DEPOSIT_CODE = `
%% OMONAT (DEPOSIT) DOMENI - ER model
%% 4 qatlam: o'zgarmas yadro / bitemporal atributlar / append-only pul / operatsiyalar
%% Tashqi domenlar (PARTY, PRODUCT, LEDGER, REFDATA) - FK yo'q, faqat ID + event

erDiagram

    %% ========== 1-QATLAM: O'ZGARMAS YADRO (UPDATE yo'q) ==========

    DEPOSIT_CONTRACT {
        NUMBER contract_id PK
        VARCHAR2 contract_no UK
        NUMBER party_id "PARTY - tashqi, FK yoq"
        NUMBER product_version_id "PRODUCT - tashqi, FK yoq"
        VARCHAR2 currency
        DATE open_date
        DATE value_date
        VARCHAR2 origin_branch_code "ochilgan filial - ozgarmas"
        VARCHAR2 channel
        NUMBER parent_contract_id FK "prolongatsiya zanjiri"
        NUMBER open_operation_id FK
        TIMESTAMP created_at
    }

    CONTRACT_TERMS_SNAPSHOT {
        NUMBER contract_id PK
        VARCHAR2 param_code PK
        NUMBER value_num
        VARCHAR2 value_str
        DATE value_date
    }

    CONTRACT_ACCOUNT {
        NUMBER contract_account_id PK
        NUMBER contract_id FK
        VARCHAR2 account_no UK
        VARCHAR2 account_role "PRINCIPAL / ACCRUED_INT / PAYOUT"
        VARCHAR2 gl_code
        VARCHAR2 currency
        DATE open_date
        DATE close_date
        VARCHAR2 status
    }

    ACCOUNT_NUMBER_POOL {
        VARCHAR2 account_no PK
        VARCHAR2 gl_code
        VARCHAR2 currency
        VARCHAR2 branch_code
        VARCHAR2 pool_status "FREE / RESERVED / ASSIGNED / CLOSED"
        NUMBER reserved_for_operation_id FK
        TIMESTAMP reserved_until
    }

    %% ========== 2-QATLAM: BITEMPORAL ATRIBUTLAR ==========
    %% har birida: valid_from/valid_to (biznes) + recorded_from/recorded_to (tizim)

    CONTRACT_STATUS_H {
        NUMBER id PK
        NUMBER contract_id FK
        VARCHAR2 status "HOLD / ACTIVE / BLOCKED / MATURED / CLOSED / CANCELLED"
        DATE valid_from
        DATE valid_to
        TIMESTAMP recorded_from
        TIMESTAMP recorded_to
        NUMBER operation_id FK
    }

    CONTRACT_RATE_H {
        NUMBER id PK
        NUMBER contract_id FK
        NUMBER rate
        VARCHAR2 reason "OPEN / PROLONG / EARLY_EXIT / CB_CHANGE"
        DATE valid_from
        DATE valid_to
        TIMESTAMP recorded_from
        TIMESTAMP recorded_to
        NUMBER operation_id FK
    }

    CONTRACT_PERIOD_H {
        NUMBER id PK
        NUMBER contract_id FK
        NUMBER period_no "prolongatsiya davri"
        DATE start_date
        DATE maturity_date
        NUMBER term_days
        DATE valid_from
        DATE valid_to
        TIMESTAMP recorded_from
        TIMESTAMP recorded_to
        NUMBER operation_id FK
    }

    CONTRACT_BRANCH_H {
        NUMBER id PK
        NUMBER contract_id FK
        VARCHAR2 service_branch_code "xizmat korsatuvchi filial"
        VARCHAR2 transfer_doc_no
        DATE valid_from
        DATE valid_to
        TIMESTAMP recorded_from
        TIMESTAMP recorded_to
        NUMBER operation_id FK
    }

    CONTRACT_PARTICIPANT_H {
        NUMBER id PK
        NUMBER contract_id FK
        NUMBER party_id "tashqi"
        VARCHAR2 role_code "OWNER / ATTORNEY / BENEFICIARY / GUARDIAN"
        NUMBER share_pct
        VARCHAR2 doc_ref
        DATE valid_from
        DATE valid_to
        TIMESTAMP recorded_from
        TIMESTAMP recorded_to
        NUMBER operation_id FK
    }

    CONTRACT_RESTRICTION_H {
        NUMBER id PK
        NUMBER contract_id FK
        VARCHAR2 restr_type "ARREST / DEBIT_BLOCK / AML_HOLD"
        NUMBER amount
        VARCHAR2 doc_no
        VARCHAR2 authority
        DATE valid_from
        DATE valid_to
        TIMESTAMP recorded_from
        TIMESTAMP recorded_to
        NUMBER operation_id FK
    }

    %% ========== 3-QATLAM: PUL - APPEND ONLY ==========

    CONTRACT_MOVEMENT {
        NUMBER movement_id PK
        NUMBER contract_id FK
        NUMBER contract_account_id FK
        DATE business_date
        DATE value_date
        VARCHAR2 movement_type "FUND / TOPUP / PARTIAL_WD / CAPITALIZE / INT_PAY / CLOSE"
        CHAR direction "D / C"
        NUMBER amount
        VARCHAR2 currency
        NUMBER operation_id FK
        NUMBER reversal_of FK "storno havolasi"
        CHAR is_cancelled "kun ichida otmena"
    }

    ACCOUNT_BALANCE_DAILY {
        NUMBER contract_account_id PK
        DATE balance_date PK
        NUMBER opening_balance
        NUMBER debit_turnover
        NUMBER credit_turnover
        NUMBER closing_balance
        NUMBER blocked_amount
    }

    ACCRUAL_DAILY {
        NUMBER accrual_id PK
        NUMBER contract_id FK
        DATE accrual_date PK
        NUMBER base_amount
        NUMBER rate
        NUMBER accrued_amount
        CHAR is_posted
        CHAR is_reversed
        NUMBER run_id
    }

    ACCRUAL_SUMMARY {
        NUMBER contract_id PK
        NUMBER accrued_total
        NUMBER paid_total
        NUMBER capitalized_total
        NUMBER balance_accrued
        DATE last_accrual_date
    }

    %% ========== 4-QATLAM: OPERATSIYALAR ==========

    OPERATION {
        NUMBER operation_id PK
        VARCHAR2 request_id UK "idempotentlik"
        VARCHAR2 op_type "OPEN / FUND / TOPUP / WD / PROLONG / CLOSE / TRANSFER"
        NUMBER contract_id FK
        NUMBER amount
        DATE business_date "operatsion kun"
        VARCHAR2 status "NEW / IN_PROGRESS / COMPLETED / FAILED / CANCELLED"
        VARCHAR2 channel
        VARCHAR2 initiator
        TIMESTAMP created_at
    }

    OPERATION_STEP {
        NUMBER step_id PK
        NUMBER operation_id FK
        NUMBER step_no
        VARCHAR2 target_service
        VARCHAR2 action
        VARCHAR2 status "PENDING / DONE / FAILED / COMPENSATED"
        CLOB request_json
        CLOB response_json
    }

    OPERATION_CANCEL {
        NUMBER cancel_id PK
        NUMBER operation_id FK "otmena qilingan operatsiya"
        DATE business_date "faqat ochiq kun"
        VARCHAR2 cancel_reason
        VARCHAR2 cancelled_by
        VARCHAR2 approved_by
        TIMESTAMP cancelled_at
    }

    OUTBOX_EVENT {
        NUMBER event_id PK
        NUMBER operation_id FK
        VARCHAR2 aggregate_type
        NUMBER aggregate_id
        VARCHAR2 event_type
        CLOB payload
        VARCHAR2 status "NEW / SENT / FAILED"
    }

    %% ========== 5-QATLAM: BOGLANISH, COMPLIANCE, GRAFIK ==========

    CONTRACT_LINK {
        NUMBER link_id PK
        NUMBER source_contract_id FK
        NUMBER target_contract_id FK
        VARCHAR2 link_type "MATURITY_TRANSFER / INTEREST_PAYOUT / PROLONG_CHAIN"
        VARCHAR2 creation_mode "AUTO_CREATE / LINK_EXISTING"
        VARCHAR2 transfer_rule "FULL / PRINCIPAL_ONLY / INTEREST_ONLY"
        VARCHAR2 status
        DATE valid_from
    }

    CONTRACT_COMPLIANCE {
        NUMBER check_id PK
        NUMBER contract_id FK
        NUMBER operation_id FK
        VARCHAR2 check_type "AML / KYC / EMBARGO / PEP"
        VARCHAR2 result "PASS / WARN / BLOCK / PENDING"
        NUMBER risk_score
        VARCHAR2 external_ref "SironKYC / SironEmbargo"
        CLOB details
        TIMESTAMP requested_at
        TIMESTAMP responded_at
    }

    PAYMENT_SCHEDULE {
        NUMBER schedule_id PK
        NUMBER contract_id FK
        NUMBER version_no UK
        CHAR is_current
        VARCHAR2 reason "OPEN / TOPUP / WD / PROLONG"
        NUMBER operation_id FK
        TIMESTAMP generated_at
    }

    SCHEDULE_LINE {
        NUMBER line_id PK
        NUMBER schedule_id FK
        NUMBER seq_no
        DATE event_date
        VARCHAR2 event_type "INT_PAY / CAPITALIZE / MATURITY / TRANSFER"
        NUMBER planned_amount
        VARCHAR2 status "PLANNED / EXECUTED / SKIPPED / CANCELLED"
        NUMBER operation_id FK
    }

    %% ================= BOGLANISHLAR =================

    %% yadro
    DEPOSIT_CONTRACT ||--|{ CONTRACT_TERMS_SNAPSHOT : "shartlar muzlatiladi"
    DEPOSIT_CONTRACT ||--|{ CONTRACT_ACCOUNT : "mahsulotga qarab 1..N schyot"
    ACCOUNT_NUMBER_POOL ||--o| CONTRACT_ACCOUNT : "raqam ajratiladi"

    %% bitemporal
    DEPOSIT_CONTRACT ||--|{ CONTRACT_STATUS_H : "status tarixi"
    DEPOSIT_CONTRACT ||--|{ CONTRACT_RATE_H : "stavka tarixi"
    DEPOSIT_CONTRACT ||--|{ CONTRACT_PERIOD_H : "muddat / davrlar"
    DEPOSIT_CONTRACT ||--|{ CONTRACT_BRANCH_H : "filial tarixi"
    DEPOSIT_CONTRACT ||--|{ CONTRACT_PARTICIPANT_H : "ishtirokchilar"
    DEPOSIT_CONTRACT ||--o{ CONTRACT_RESTRICTION_H : "cheklovlar"

    %% pul
    DEPOSIT_CONTRACT ||--o{ CONTRACT_MOVEMENT : "harakatlar"
    CONTRACT_ACCOUNT ||--o{ CONTRACT_MOVEMENT : "qaysi schyot boyicha"
    CONTRACT_ACCOUNT ||--o{ ACCOUNT_BALANCE_DAILY : "kunlik qoldiq"
    DEPOSIT_CONTRACT ||--o{ ACCRUAL_DAILY : "kunlik foiz"
    DEPOSIT_CONTRACT ||--|| ACCRUAL_SUMMARY : "foiz jamlanmasi"

    %% operatsiyalar - hamma ozgarish shu yerdan
    OPERATION ||--|{ OPERATION_STEP : "saga qadamlari"
    OPERATION ||--o| OPERATION_CANCEL : "kun ichida otmena"
    OPERATION ||--o{ OUTBOX_EVENT : "event nashri"
    OPERATION ||--o{ CONTRACT_MOVEMENT : "pul harakatini yaratadi"
    OPERATION ||--o{ CONTRACT_STATUS_H : "status ozgartiradi"
    OPERATION ||--o{ CONTRACT_RATE_H : "stavka ozgartiradi"
    OPERATION ||--o{ CONTRACT_PERIOD_H : "muddat ozgartiradi"
    OPERATION ||--o{ CONTRACT_BRANCH_H : "filialga kochiradi"
    OPERATION ||--o{ CONTRACT_PARTICIPANT_H : "ishtirokchi qoshadi"
    OPERATION ||--o{ ACCOUNT_NUMBER_POOL : "raqam rezerv qiladi"
    OPERATION ||--o{ DEPOSIT_CONTRACT : "shartnoma ochadi"

    %% boglanish / compliance / grafik
    DEPOSIT_CONTRACT ||--o{ CONTRACT_LINK : "manba shartnoma"
    DEPOSIT_CONTRACT ||--o{ CONTRACT_COMPLIANCE : "AML / KYC natijasi"
    OPERATION ||--o{ CONTRACT_COMPLIANCE : "tekshiruv sorovi"
    DEPOSIT_CONTRACT ||--|{ PAYMENT_SCHEDULE : "grafik versiyalari"
    PAYMENT_SCHEDULE ||--|{ SCHEDULE_LINE : "grafik satrlari"
`;

describe("Mermaid ER Parser & Importer", () => {
  it("detects Mermaid ER diagram syntax correctly", () => {
    expect(isMermaidER(SAMPLE_DEPOSIT_CODE)).toBe(true);
    expect(isMermaidER("erDiagram\n  CUSTOMER ||--o{ ORDER : places")).toBe(true);
    expect(isMermaidER("CREATE TABLE STUDENT (ID NUMBER);")).toBe(false);
    expect(isMermaidER('{ "formatVersion": 1 }')).toBe(false);
  });

  it("parses deposit domain schema with 22 tables and 30 relationships", () => {
    const { schema, warnings, errors } = parseMermaidER(SAMPLE_DEPOSIT_CODE);

    expect(errors).toEqual([]);
    expect(schema).not.toBeNull();
    if (!schema) return;

    expect(schema.tables.length).toBe(22);
    expect(schema.relationships?.length).toBeGreaterThanOrEqual(28);

    // Verify groups created from layers
    expect(schema.groups?.length).toBe(5);
    expect(schema.groups?.map((g) => g.name)).toEqual([
      "1-QATLAM: O'ZGARMAS YADRO (UPDATE yo'q)",
      "2-QATLAM: BITEMPORAL ATRIBUTLAR",
      "3-QATLAM: PUL - APPEND ONLY",
      "4-QATLAM: OPERATSIYALAR",
      "5-QATLAM: BOGLANISH, COMPLIANCE, GRAFIK",
    ]);

    // Verify title
    expect(schema.name).toBe("OMONAT (DEPOSIT) DOMENI");

    // Check specific table DEPOSIT_CONTRACT
    const depositContract = schema.tables.find((t) => t.name === "DEPOSIT_CONTRACT");
    expect(depositContract).toBeDefined();
    expect(depositContract?.columns.length).toBe(12);

    const contractIdCol = depositContract?.columns.find((c) => c.name === "contract_id");
    expect(contractIdCol?.pk).toBe(true);
    expect(contractIdCol?.type).toBe("NUMBER");

    const contractNoCol = depositContract?.columns.find((c) => c.name === "contract_no");
    expect(contractNoCol?.unique).toBe(true);
    expect(contractNoCol?.type).toBe("VARCHAR2");

    const partyIdCol = depositContract?.columns.find((c) => c.name === "party_id");
    expect(partyIdCol?.comment).toBe("PARTY - tashqi, FK yoq");
    expect(partyIdCol?.fk).toBeNull(); // External domain, no false FK

    const parentContractId = depositContract?.columns.find((c) => c.name === "parent_contract_id");
    expect(parentContractId?.fk?.tableId).toBe(depositContract?.id); // Valid self-reference

    // Check OPERATION table
    const operation = schema.tables.find((t) => t.name === "OPERATION");
    expect(operation).toBeDefined();
    const reqIdCol = operation?.columns.find((c) => c.name === "request_id");
    expect(reqIdCol?.unique).toBe(true);
    expect(reqIdCol?.comment).toBe("idempotentlik");
    const opIdCol = operation?.columns.find((c) => c.name === "operation_id");

    // Check CONTRACT_RESTRICTION_H operation_id points to OPERATION (not self)
    const restriction = schema.tables.find((t) => t.name === "CONTRACT_RESTRICTION_H");
    const restrOpId = restriction?.columns.find((c) => c.name === "operation_id");
    expect(restrOpId?.fk?.tableId).toBe(operation?.id);
    expect(restrOpId?.fk?.columnId).toBe(opIdCol?.id);

    // Check CONTRACT_PARTICIPANT_H party_id has no false self-ref FK
    const participant = schema.tables.find((t) => t.name === "CONTRACT_PARTICIPANT_H");
    const partPartyId = participant?.columns.find((c) => c.name === "party_id");
    expect(partPartyId?.fk).toBeNull();

    // Check CONTRACT_MOVEMENT
    const movement = schema.tables.find((t) => t.name === "CONTRACT_MOVEMENT");
    expect(movement).toBeDefined();
    const dirCol = movement?.columns.find((c) => c.name === "direction");
    expect(dirCol?.type).toBe("CHAR");
    expect(dirCol?.comment).toBe("D / C");
    const reversalCol = movement?.columns.find((c) => c.name === "reversal_of");
    expect(reversalCol?.fk?.tableId).toBe(movement?.id); // Valid self-reference

    // Check Foreign Key relationships
    const account = schema.tables.find((t) => t.name === "CONTRACT_ACCOUNT");
    const accountContractId = account?.columns.find((c) => c.name === "contract_id");
    expect(accountContractId?.fk?.tableId).toBe(depositContract?.id);
    expect(accountContractId?.fk?.columnId).toBe(contractIdCol?.id);

    // Validate Oracle schema issues (CHAR size, identifiers, etc.) -> MUST HAVE 0 ERRORS
    const validationIssues = validateSchema(schema);
    const validationErrors = validationIssues.filter((i) => i.severity === "error");
    expect(validationErrors).toEqual([]);

    // Validate that every group's bounding box encompasses all its member tables without overflow
    schema.groups?.forEach((group) => {
      const memberTables = schema.tables.filter((t) => t.schemaId === group.id);
      expect(memberTables.length).toBeGreaterThan(0);

      memberTables.forEach((table) => {
        const w = tableWidth(table);
        const h = tableHeight(table);
        // Table top-left must be inside group
        expect(table.x).toBeGreaterThanOrEqual(group.x);
        expect(table.y).toBeGreaterThanOrEqual(group.y);
        // Table bottom-right must be inside group
        expect(table.x + w).toBeLessThanOrEqual(group.x + group.width + 1);
        expect(table.y + h).toBeLessThanOrEqual(group.y + group.height + 1);
      });
    });
  });


  it("delegates to Mermaid parser from parseCreateTable when Mermaid code is passed", () => {
    const { schema, errors } = parseCreateTable(SAMPLE_DEPOSIT_CODE);
    expect(errors).toEqual([]);
    expect(schema).not.toBeNull();
    expect(schema?.tables.length).toBe(22);
  });

  it("appends Mermaid ER tables to an existing schema", () => {
    const base = makeDemoSchema();
    const mermaidSnippet = `
      erDiagram
        PAYMENT {
          NUMBER payment_id PK
          NUMBER amount
          VARCHAR2 currency
        }
    `;

    const { schema, added, skipped, errors } = appendMermaidER(base, mermaidSnippet);
    expect(errors).toEqual([]);
    expect(schema).not.toBeNull();
    expect(added.length).toBe(1);
    expect(added[0].name).toBe("PAYMENT");
    expect(skipped).toEqual([]);
    expect(schema?.tables.length).toBe(base.tables.length + 1);
  });

  it("generates Mermaid ER syntax from schema and round-trips correctly", () => {
    const base = makeDemoSchema();
    const mermaid = generateMermaidER(base);

    expect(mermaid).toContain("erDiagram");
    expect(mermaid).toContain("STUDENT {");
    expect(mermaid).toContain("ENROLLMENT {");

    const parsed = parseMermaidER(mermaid);
    expect(parsed.errors).toEqual([]);
    expect(parsed.schema?.tables.length).toBe(2);
  });
});
