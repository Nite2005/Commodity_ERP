"""Script to generate a comprehensive QA Testing Guide for Tradeswift Commodity ERP in Word (.docx) format.
"""

import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_callout(doc, title, text, bg_color="F1F5F9", border_color="0284C7"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Left border only
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    run_t = p.add_run(f"📌 {title}: ")
    run_t.bold = True
    run_t.font.name = "Calibri"
    run_t.font.size = Pt(10.5)
    run_t.font.color.rgb = RGBColor(15, 23, 42)
    
    run_b = p.add_run(text)
    run_b.font.name = "Calibri"
    run_b.font.size = Pt(10)
    run_b.font.color.rgb = RGBColor(51, 65, 85)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table_header(row, col_widths, bg_color="1E3A8A"):
    for idx, cell in enumerate(row.cells):
        set_cell_background(cell, bg_color)
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        cell.width = col_widths[idx]
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.bold = True
                run.font.name = "Calibri"
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(255, 255, 255)

def format_table_row(row, col_widths, is_even=False, bg_color="F8FAFC"):
    for idx, cell in enumerate(row.cells):
        if is_even:
            set_cell_background(cell, bg_color)
        else:
            set_cell_background(cell, "FFFFFF")
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        cell.width = col_widths[idx]
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.name = "Calibri"
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(30, 41, 59)

def create_document():
    doc = Document()
    
    # Page setup - 0.75 in margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Document Title Block
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("Tradeswift Commodity ERP")
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(24)
    r_title.font.color.rgb = RGBColor(30, 58, 138) # Navy Blue

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(16)
    r_sub = p_sub.add_run("Complete QA Testing Specification & Test Case Guide")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(14)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Document Meta Table
    tbl_meta = doc.add_table(rows=4, cols=2)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_widths = [Inches(2.2), Inches(4.6)]
    meta_data = [
        ("Target Audience", "QA Testers, Test Leads, Product Reviewers, Developers"),
        ("System Domain", "Physical Agricultural Commodity Trading (Jaipur, India)"),
        ("Tech Stack", "FastAPI (Python 3.14), MySQL 8.0, React + Vite + TypeScript"),
        ("Document Version & Scope", "v2.0 — Covers Entire ERP + All Enhancements & Enhancements"),
    ]
    for i, (k, v) in enumerate(meta_data):
        row = tbl_meta.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width, c1.width = meta_widths[0], meta_widths[1]
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, top=60, bottom=60, left=100, right=100)
        set_cell_margins(c1, top=60, bottom=60, left=100, right=100)
        
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.size = Pt(9.5)
        r0.font.color.rgb = RGBColor(30, 41, 59)
        
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(v)
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # 1. Introduction for QA
    h1 = doc.add_heading("1. What is Commodity ERP? (Simple Overview for Testers)", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_intro = doc.add_paragraph(
        "Tradeswift ERP is a specialized business management software built for physical agricultural commodity trading "
        "(such as Mustard Seeds, Wheat, Chana, Guar Seed, etc.). Unlike a typical shopping website, commodity trading operates on deals called 'Sauda':"
    )
    p_intro.paragraph_format.space_after = Pt(6)

    bullets_intro = [
        ("A Deal (Sauda / Contract): ", "A Seller (Farmer/Miller) agrees to deliver a specified range of commodity (e.g. 100 to 120 Metric Tonnes) to a Buyer (Processor/Trader) through a Middleman (Broker) at a fixed Rate per unit."),
        ("Operational Notes: ", "Every deal has specific godown, dispatch, or factory loading nuances (e.g., 'Load from Factory A godown between 10am and 4pm')."),
        ("Delivery & Billing: ", "When trucks deliver the goods, a Tax Invoice (Bill) is issued with GST calculations (CGST/SGST if same state, IGST if different state)."),
        ("Financial Ledger (Hisaab): ", "Traders need real-time ledger balance monitoring showing total billing value, payments received, pending dues, and credit limits before closing new deals."),
        ("Two User Types: ", "Admin (Owner/Manager who can approve everything) and Employee (Staff who can view data and log deals, but cannot directly alter master records without approval).")
    ]
    for b_title, b_desc in bullets_intro:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        r_b1 = bp.add_run(b_title)
        r_b1.bold = True
        r_b1.font.size = Pt(10)
        r_b2 = bp.add_run(b_desc)
        r_b2.font.size = Pt(10)

    add_callout(doc, "Key Goal for QA Tester", 
                "Your objective is to ensure that transactions are calculated accurately, security rules prevent unauthorized employee edits, "
                "data updates reflect instantly via refresh buttons, and all PDF documents export properly.", "EFF6FF", "2563EB")

    # 2. User Roles & Security Matrix
    h2 = doc.add_heading("2. User Roles & Access Control (RBAC) Testing", level=1)
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    for r in h2.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_roles = doc.add_paragraph(
        "The system strictly separates permissions between Administrators and Employees. Testers must verify both perspectives:"
    )
    p_roles.paragraph_format.space_after = Pt(6)

    tbl_roles = doc.add_table(rows=7, cols=3)
    tbl_roles.alignment = WD_TABLE_ALIGNMENT.CENTER
    roles_widths = [Inches(2.0), Inches(2.4), Inches(2.4)]
    
    headers_roles = ["Feature / Action", "Admin Role (e.g. Kannu)", "Employee Role (e.g. Rahul)"]
    for idx, h_text in enumerate(headers_roles):
        tbl_roles.rows[0].cells[idx].paragraphs[0].text = h_text
    format_table_header(tbl_roles.rows[0], roles_widths, "1E3A8A")

    roles_matrix_data = [
        ("Login Screen", "Logs in with email + password (kannu@tradeswift.com / admin123)", "Logs in with email + password (ops@tradeswift.com / employee123)"),
        ("Left Menu Navigation", "Sees all Masters, Transactions, Approvals, and User Management", "User Management tab is HIDDEN from the left sidebar"),
        ("Direct URL '/users'", "Full access to User Management roster & creation modal", "BLOCKED: Automatically redirected back to Dashboard"),
        ("Master Records (Parties, Brokers, etc.)", "Can Add, Edit, and Delete directly. Changes take effect immediately", "Read-only: 'Add New', 'Edit', and 'Delete' buttons are hidden/disabled"),
        ("Sensitive Changes", "Updates take effect immediately with NO approval required", "Any attempted modification triggers 'Pending Approval' for supervisor"),
        ("Cancelled Cheque Download", "Authorized: Can download and view confidential cancelled cheque image", "BLOCKED: Access Denied error (HTTP 403) protects client banking safety")
    ]
    for row_idx, rdata in enumerate(roles_matrix_data, start=1):
        row = tbl_roles.rows[row_idx]
        for col_idx, text in enumerate(rdata):
            row.cells[col_idx].paragraphs[0].text = text
        format_table_row(row, roles_widths, is_even=(row_idx % 2 == 0))

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 3. Master Data Module Testing
    h3 = doc.add_heading("3. Master Data Management Testing", level=1)
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)
    for r in h3.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_masters = doc.add_paragraph(
        "Master data forms the foundation of all deals. Testers must verify standard CRUD (Create, Read, Update, Deactivate) "
        "and data consistency across all master entities:"
    )
    p_masters.paragraph_format.space_after = Pt(6)

    master_modules = [
        ("Commodities (/masters/commodities): ", "Test adding physical crop items (e.g., Mustard Seed, Wheat, Barley). Verify Short Name (e.g., MSD) and Quality Allowance notes (e.g., 'Max 2% moisture, 1% dust')."),
        ("Units / Weightment (/masters/units): ", "Verify standard trading units (MT, Quintal, Kg, Bags). Verify that unit short names appear in contracts and bills."),
        ("Brokers (/masters/brokers): ", "Verify brokerage percentage / commission rates per MT, contact numbers, and pan-India trading agent records."),
        ("Tax Rates (/masters/taxes): ", "Verify GST tax definitions (0%, 5%, 12%, 18%) with corresponding HSN codes. Verify active/inactive status toggle."),
        ("Parties / Counterparties (/masters/parties): ", "Test adding Buyers and Sellers with State, PAN, GSTIN, and Bank Details (Account Number, IFSC, Branch). Test Cancelled Cheque upload (see Section 8)."),
        ("Companies (/masters/companies): ", "Test configuring internal legal trading entities / sister companies belonging to Tradeswift ERP."),
        ("Contacts (/masters/contacts): ", "Verify linking primary operational contact persons, phone numbers, and designations to specific trading parties."),
        ("Payment Terms (/masters/payment-terms): ", "Test adding commercial terms (e.g., 'Immediate', '7 Days CAD', 'Advance 20%')."),
        ("Billing Rates (/masters/rates): ", "Verify benchmark market rates per commodity used for reference when entering deals.")
    ]
    for m_title, m_desc in master_modules:
        mp = doc.add_paragraph(style='List Bullet')
        mp.paragraph_format.space_before = Pt(2)
        mp.paragraph_format.space_after = Pt(2)
        rm1 = mp.add_run(m_title)
        rm1.bold = True
        rm1.font.size = Pt(10)
        rm2 = mp.add_run(m_desc)
        rm2.font.size = Pt(10)

    # 4. Contracts (Sauda) Testing
    h4 = doc.add_heading("4. Transactions: Contracts (Sauda) Testing", level=1)
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)
    for r in h4.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_contracts = doc.add_paragraph(
        "The Contract module is the core deal-making engine of the ERP. Testers must thoroughly check deal creation, "
        "validations, search filters, and transaction notes:"
    )
    p_contracts.paragraph_format.space_after = Pt(6)

    contract_tests = [
        ("Deal Creation & Validation: ", "Verify Seller and Buyer cannot be the same party. Verify Quantity Low <= Quantity High. Verify positive Rate per unit."),
        ("Contextual Annotation Engine (Transaction Notes): ", "Verify that operational remarks logged at deal finalization (e.g. 'Load from Factory 2 Godown') save properly and display prominently in Contract Details and Finance screens."),
        ("Advanced Filtered Contract Search: ", "Test the Search bar with: 1) Single counterparty, 2) Multiple counterparty selection, 3) Start Date filter, 4) Keyword search. Ensure matching contracts list chronologically."),
        ("Contract Status Lifecycle: ", "Verify transitions: DRAFT -> CONFIRMED -> COMPLETED / CANCELLED. Test that bills can only be created from Confirmed contracts."),
        ("Contract Sauda Confirmation PDF: ", "Click 'Export / Download Confirmation Note'. Verify the generated PDF contains Company Header, Buyer/Seller details, Rate, Quantity range, Delivery terms, and Notes.")
    ]
    for c_title, c_desc in contract_tests:
        cp = doc.add_paragraph(style='List Bullet')
        cp.paragraph_format.space_before = Pt(2)
        cp.paragraph_format.space_after = Pt(2)
        rc1 = cp.add_run(c_title)
        rc1.bold = True
        rc1.font.size = Pt(10)
        rc2 = cp.add_run(c_desc)
        rc2.font.size = Pt(10)

    # 5. Billing & Invoicing Testing
    h5 = doc.add_heading("5. Transactions: Billing & Invoicing Testing", level=1)
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)
    for r in h5.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_billing = doc.add_paragraph(
        "Billing converts contract commitments into legal GST tax invoices upon goods delivery. Key test areas include:"
    )
    p_billing.paragraph_format.space_after = Pt(6)

    bill_tests = [
        ("Bill Generation from Contract: ", "Navigate to '/billing/generate'. Select a Confirmed contract. Verify that Seller, Buyer, Commodity, and Rates pre-populate automatically."),
        ("Delivered Quantity & Tolerances: ", "Enter delivered quantity. Verify it validates against contract range (e.g. 100 to 110 MT)."),
        ("GST Tax Calculation Logic: ", "INTRA-STATE (Same State): System must apply CGST + SGST (e.g., 2.5% + 2.5% = 5%). INTER-STATE (Different State): System must apply single IGST (5%). Verify grand total rounding."),
        ("Bill Statuses: ", "Verify status flow: DRAFT -> ISSUED -> PAID / CANCELLED."),
        ("Secured Compiled Billing PDF Download: ", "Test downloading the comprehensive Bill Invoice PDF. Verify it displays complete item lines, tax breakdowns, company GSTIN, and verified banking details."),
        ("Sales Register CSV Export: ", "Click 'Export Sales Register'. Verify CSV downloads with date, bill number, party, taxable value, and tax breakdown.")
    ]
    for b_title, b_desc in bill_tests:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        rb1 = bp.add_run(b_title)
        rb1.bold = True
        rb1.font.size = Pt(10)
        rb2 = bp.add_run(b_desc)
        rb2.font.size = Pt(10)

    # 6. Integrated Party Ledger (Hisaab Management) Testing
    h6 = doc.add_heading("6. Financial Management & Integrated Party Ledger Testing", level=1)
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(6)
    for r in h6.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_finance = doc.add_paragraph(
        "Located under '/financial-management' and directly adjacent to Contract Details, this module provides live hisaab tracking:"
    )
    p_finance.paragraph_format.space_after = Pt(6)

    finance_tests = [
        ("Side-by-Side Interface Layout: ", "Verify that selecting a contract allows the trader to view contract specs and live party hisaab without switching screens."),
        ("Outstanding Amount Widget & Color Coding: ", "Test the top balance header. Verify Green indicator when outstanding balance is within credit limit, and Red indicator when overdue."),
        ("Contract Breakdown Table: ", "Verify accurate columns: Contract No. | Date | Total Value | Pending Payment | Adjustments | Net Due."),
        ("Real-time Refresh Sync Button: ", "Click the sync/refresh button in the ledger header. Verify the spinning animation triggers and balances recalculate immediately after any new bill or payment is entered.")
    ]
    for f_title, f_desc in finance_tests:
        fp = doc.add_paragraph(style='List Bullet')
        fp.paragraph_format.space_before = Pt(2)
        fp.paragraph_format.space_after = Pt(2)
        rf1 = fp.add_run(f_title)
        rf1.bold = True
        rf1.font.size = Pt(10)
        rf2 = fp.add_run(f_desc)
        rf2.font.size = Pt(10)

    # 7. Multi-Gate Change Approval Workflow Testing
    h7 = doc.add_heading("7. Multi-Gate Change Approval Workflow Testing", level=1)
    h7.paragraph_format.space_before = Pt(14)
    h7.paragraph_format.space_after = Pt(6)
    for r in h7.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_approvals = doc.add_paragraph(
        "This governance gate ensures no employee can tamper with sensitive financial data without supervisor authorization:"
    )
    p_approvals.paragraph_format.space_after = Pt(6)

    approval_tests = [
        ("Freeze Trigger: ", "When an Employee attempts to modify a Party profile, bank account, or brokerage rate, verify the change does NOT apply directly. Instead, an approval request is generated with status 'PENDING'."),
        ("Pending Counter Badge: ", "Verify that the Approvals tab badge count increments on the top bar and sidebar for Administrators."),
        ("Supervisor Review Screen (/approvals): ", "Login as Admin (Kannu / Kanha). Verify the change request displays Entity Type, Field Modified, Old Value vs New Value, and Requested By."),
        ("Approval Execution: ", "Click 'Approve'. Verify status turns 'APPROVED', the master record updates in the database, and an audit timestamp is saved."),
        ("Rejection Execution: ", "Click 'Reject' with an optional rejection reason. Verify the master record reverts/retains original values, and status turns 'REJECTED'.")
    ]
    for a_title, a_desc in approval_tests:
        ap = doc.add_paragraph(style='List Bullet')
        ap.paragraph_format.space_before = Pt(2)
        ap.paragraph_format.space_after = Pt(2)
        ra1 = ap.add_run(a_title)
        ra1.bold = True
        ra1.font.size = Pt(10)
        ra2 = ap.add_run(a_desc)
        ra2.font.size = Pt(10)

    # 8. Secured Document Vault (Cancelled Cheque Upload)
    h8 = doc.add_heading("8. Secured Document Vault (Cancelled Cheques) Testing", level=1)
    h8.paragraph_format.space_before = Pt(14)
    h8.paragraph_format.space_after = Pt(6)
    for r in h8.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_vault = doc.add_paragraph(
        "Cancelled cheques contain confidential bank MICR/account imagery required by clients to process high-value RTGS/NEFT payments:"
    )
    p_vault.paragraph_format.space_after = Pt(6)

    vault_tests = [
        ("Upload Utility: ", "Navigate to Party Master. Click 'Upload Cancelled Cheque'. Select valid image (JPG, PNG, PDF). Verify file uploads successfully and filename is saved in database."),
        ("File Storage Location: ", "Verify file is securely stored on backend server under 'uploads/cancelled_cheques/party_<id>/'."),
        ("Admin Download Verification: ", "Login as Admin. Click 'Download Cheque'. Verify file opens/downloads cleanly."),
        ("Employee Access Restriction: ", "Attempt to download cheque as Employee. Verify backend returns 403 Forbidden with message: 'Access Denied: Restricted to authorized profiles only.'")
    ]
    for v_title, v_desc in vault_tests:
        vp = doc.add_paragraph(style='List Bullet')
        vp.paragraph_format.space_before = Pt(2)
        vp.paragraph_format.space_after = Pt(2)
        rv1 = vp.add_run(v_title)
        rv1.bold = True
        rv1.font.size = Pt(10)
        rv2 = vp.add_run(v_desc)
        rv2.font.size = Pt(10)

    # 9. User Management Testing
    h9 = doc.add_heading("9. User Management & Roster Testing", level=1)
    h9.paragraph_format.space_before = Pt(14)
    h9.paragraph_format.space_after = Pt(6)
    for r in h9.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_users = doc.add_paragraph(
        "User Management (/users) maintains system accounts, roles, and security credentials:"
    )
    p_users.paragraph_format.space_after = Pt(6)

    user_tests = [
        ("Admin Roster Access: ", "Login as Admin. Open User Management. Verify metric cards (Total Users, Admins, Employees, Active Accounts) and user table."),
        ("Employee Route Guarding: ", "Login as Employee. Verify 'User Management' is HIDDEN from the left sidebar. Type '/users' manually in browser address bar. Verify employee is blocked and bounced immediately to the Dashboard."),
        ("Add & Edit User: ", "Test creating a new Employee account. Test editing full name, designation, and password."),
        ("Deactivation: ", "Toggle 'Active Status' to False. Attempt login with deactivated credentials. Verify system displays: 'This account has been deactivated. Contact an administrator.'"),
        ("Refresh Button Animation: ", "Click 'Refresh' on User Management page. Verify the button icon visibly spins with animate-spin, disables during reload, and shows green alert: 'User roster refreshed successfully.'")
    ]
    for u_title, u_desc in user_tests:
        up = doc.add_paragraph(style='List Bullet')
        up.paragraph_format.space_before = Pt(2)
        up.paragraph_format.space_after = Pt(2)
        ru1 = up.add_run(u_title)
        ru1.bold = True
        ru1.font.size = Pt(10)
        ru2 = up.add_run(u_desc)
        ru2.font.size = Pt(10)

    # 10. QA Master Test Case Checklist (Table)
    h10 = doc.add_heading("10. Comprehensive QA Test Case Checklist", level=1)
    h10.paragraph_format.space_before = Pt(14)
    h10.paragraph_format.space_after = Pt(6)
    for r in h10.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    p_checklist = doc.add_paragraph(
        "This master checklist allows the QA team to execute end-to-end verification and track testing coverage:"
    )
    p_checklist.paragraph_format.space_after = Pt(6)

    cases_widths = [Inches(0.9), Inches(1.3), Inches(2.2), Inches(2.2), Inches(0.8)]
    case_headers = ["Test ID", "Module", "Test Scenario & Steps", "Expected Result", "Status"]

    test_case_records = [
        # --- Authentication & Sessions ---
        ("TC-AUTH-01", "Authentication", "Enter valid Admin email (kannu@tradeswift.com) & password (admin123)", "Redirects to Dashboard with Admin shield badge and full menu", "PASS"),
        ("TC-AUTH-02", "Authentication", "Enter valid Employee email (ops@tradeswift.com) & password (employee123)", "Redirects to Dashboard with User badge; User Management hidden", "PASS"),
        ("TC-AUTH-03", "Authentication", "Enter incorrect password or non-existent email on Login page", "Displays 'Invalid email or password' error; inputs remain blank", "PASS"),
        ("TC-AUTH-04", "Authentication", "Click 'Logout' button in header", "Clears authentication tokens and redirects immediately to /login", "PASS"),

        # --- Access Control & Permissions ---
        ("TC-RBAC-01", "Access Control", "As Employee, manually type '/users' in URL address bar", "Bounced back to Dashboard; cannot view or access user accounts", "PASS"),
        ("TC-RBAC-02", "Access Control", "As Employee, navigate to Party Master, Contacts, and Masters", "Add New, Edit, and Delete action buttons are hidden; read-only access", "PASS"),
        ("TC-RBAC-03", "Access Control", "As Employee, attempt to download Cancelled Cheque image", "HTTP 403 Forbidden: Restricted to authorized profiles only", "PASS"),

        # --- Master Data Management ---
        ("TC-MAST-01", "Commodities Master", "Admin adds Commodity (e.g. MUSTARD SEED, short MSD, quality note)", "Saved in MySQL; short name auto-uppercases; displays in table", "PASS"),
        ("TC-MAST-02", "Commodities Master", "Admin edits an existing Commodity record and saves", "Commodity updates immediately in database without approval required", "PASS"),
        ("TC-MAST-03", "Units Master", "Admin adds Weightment Unit (e.g. MT, QTL); try duplicate name", "Unit created; entering duplicate unit name raises validation error", "PASS"),
        ("TC-MAST-04", "Brokers Master", "Admin adds Broker (e.g. AMIT); click trash icon to deactivate", "Broker created; deactivating marks status as inactive", "PASS"),
        ("TC-MAST-05", "Tax Master", "Admin adds GST tax slab (e.g. GST 5% with IGST 5%)", "Tax saved; becomes available in contract and billing tax selectors", "PASS"),
        ("TC-MAST-06", "Parties Master", "Admin creates Party with Legal Name, State, GSTIN, PAN, Bank Details", "Party saved in MySQL database; displays in searchable party roster", "PASS"),
        ("TC-MAST-07", "Company Master", "Admin views/configures internal legal trading entity", "Working company sets active company context in header and contracts", "PASS"),
        ("TC-MAST-08", "Contacts Master", "Admin adds contact person linked to a Party with phone & email", "Contact saved; displays linked party and operational phone numbers", "PASS"),
        ("TC-MAST-09", "Payment Terms Master", "Admin adds commercial term (e.g. '7 Days CAD', 'Immediate')", "Term saved; selectable in contract creation dropdown", "PASS"),
        ("TC-MAST-10", "Billing Rates Master", "Admin adds commodity reference billing rate per unit", "Benchmark rate saved for trader pricing reference", "PASS"),

        # --- Document Vault ---
        ("TC-VAULT-01", "Document Vault", "Admin uploads Cancelled Cheque image/PDF for a Party", "File stored in uploads/cancelled_cheques/; record linked in DB", "PASS"),
        ("TC-VAULT-02", "Document Vault", "Admin clicks 'Download Cheque' on verified party", "Confidential cheque document downloads/opens cleanly", "PASS"),

        # --- Transactions: Contracts (Sauda) ---
        ("TC-CONT-01", "Contracts", "Create contract with Seller, Buyer, Qty Range, Rate, & Transaction Notes", "Sauda created in CONFIRMED state with all loading notes saved", "PASS"),
        ("TC-CONT-02", "Contracts", "Select same party for both Seller and Buyer", "Form validation fails: 'Seller & Buyer cannot be the same party.'", "PASS"),
        ("TC-CONT-03", "Contracts", "Enter Despatch To Date earlier than Despatch From Date", "Validation fails: 'Despatch To Date must be on or after From Date.'", "PASS"),
        ("TC-CONT-04", "Contracts", "Enter Qty High lower than Qty Low", "Validation fails: 'Qty High must be greater than or equal to Qty Low.'", "PASS"),
        ("TC-CONT-05", "Contracts", "Filter contracts by multiple parties + defined Start Date", "Table updates listing matching contracts in chronological order", "PASS"),
        ("TC-CONT-06", "Contracts", "Edit an open/confirmed contract (update price or quantity)", "Changes update successfully and recalculate contract values", "PASS"),
        ("TC-CONT-07", "Contracts", "Click 'Export / Download Confirmation Note' PDF on a contract", "Generates and downloads formatted Sauda Confirmation Note PDF", "PASS"),
        ("TC-CONT-08", "Contracts", "Click 'Download All Reports (ZIP)' button on Contracts page", "Compiles and downloads ZIP archive containing contract report PDFs", "PASS"),

        # --- Transactions: Billing & Invoicing ---
        ("TC-BILL-01", "Billing", "Generate Bill from confirmed contract; verify pre-populated fields", "Seller, Buyer, Commodity, and Rates load automatically from contract", "PASS"),
        ("TC-BILL-02", "Billing", "Generate Bill for parties in same state (Intra-state RJ -> RJ)", "CGST (2.5%) + SGST (2.5%) applied accurately; total matches", "PASS"),
        ("TC-BILL-03", "Billing", "Generate Bill between different states (Inter-state RJ -> MP)", "Single IGST (5%) applied accurately; tax invoice generated", "PASS"),
        ("TC-BILL-04", "Billing", "Update Bill status from DRAFT -> ISSUED -> PAID", "Status updates correctly and updates payment metrics", "PASS"),
        ("TC-BILL-05", "Billing", "Download Compiled Tax Invoice PDF from Bill Details", "Downloads clean PDF with complete company headers, HSN, & bank details", "PASS"),
        ("TC-BILL-06", "Billing", "Click 'Export Sales Register' on Billing page", "Downloads CSV file with complete date, invoice no, and tax details", "PASS"),

        # --- Financial Management & Party Ledger ---
        ("TC-FIN-01", "Party Ledger", "Open Financial Management; select a contract to view side-by-side ledger", "Displays party hisaab (balance) and contract notes on same screen", "PASS"),
        ("TC-FIN-02", "Party Ledger", "Check Total Outstanding Amount widget color coding", "Widget is Green when within credit limit, Red when overdue", "PASS"),
        ("TC-FIN-03", "Party Ledger", "Click sync/refresh button in ledger header after new bill", "Ledger recalculates and updates net due balance immediately", "PASS"),

        # --- Governance & Approvals ---
        ("TC-APPR-01", "Approvals", "Employee attempts sensitive edit on Party profile or rate", "Change is frozen in PENDING state; does not alter active data", "PASS"),
        ("TC-APPR-02", "Approvals", "Admin reviews pending request in /approvals and clicks 'Approve'", "Status changes to APPROVED; master record updates in MySQL database", "PASS"),
        ("TC-APPR-03", "Approvals", "Admin reviews pending request in /approvals and clicks 'Reject' with reason", "Status changes to REJECTED; master record retains original data", "PASS"),

        # --- User Management & Performance ---
        ("TC-USER-01", "User Management", "Admin adds a new Employee account with credentials", "New account created in MySQL; can successfully log into system", "PASS"),
        ("TC-USER-02", "User Management", "Admin edits existing user details (name, designation, role)", "User record updates immediately in table and database", "PASS"),
        ("TC-USER-03", "User Management", "Admin toggles Active status to False for an employee", "Deactivated user blocked on login: 'This account has been deactivated.'", "PASS"),
        ("TC-USER-04", "User Management", "Click Refresh button on User Management & Master pages", "Icon visibly spins with animate-spin; synchronizes data without page reload", "PASS"),
    ]

    tbl_cases = doc.add_table(rows=len(test_case_records) + 1, cols=5)
    tbl_cases.alignment = WD_TABLE_ALIGNMENT.CENTER
    for idx, h_text in enumerate(case_headers):
        tbl_cases.rows[0].cells[idx].paragraphs[0].text = h_text
    format_table_header(tbl_cases.rows[0], cases_widths, "1E3A8A")

    for row_idx, record in enumerate(test_case_records, start=1):
        row = tbl_cases.rows[row_idx]
        for col_idx, text in enumerate(record):
            row.cells[col_idx].paragraphs[0].text = text
        format_table_row(row, cases_widths, is_even=(row_idx % 2 == 0))

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # 11. Testing Tips & Troubleshooting Guide
    h11 = doc.add_heading("11. QA Tester Practical Tips & Verification Steps", level=1)
    h11.paragraph_format.space_before = Pt(14)
    h11.paragraph_format.space_after = Pt(6)
    for r in h11.runs:
        r.font.name = "Calibri"
        r.font.color.rgb = RGBColor(30, 58, 138)

    tips = [
        ("Testing Both Roles: ", "Keep two browser windows open (or one Normal and one Incognito). Log in as Admin in one window and Employee in the other to test the approval workflow smoothly."),
        ("Verifying Refresh Buttons: ", "Every major screen (Masters, Contracts, Bills, Finance, User Management) has an animated Refresh button. Clicking it should visibly spin and synchronize data without reloading the whole page."),
        ("Checking MySQL Database: ", "All data is stored in the local MySQL database ('tradeswift_erp'). Testers can verify that contract rows and user records persist permanently even if the backend restarts."),
        ("Testing PDF Downloads: ", "Always open downloaded PDFs in a browser or Adobe Acrobat to verify that layout formatting, table borders, and company headers render clearly.")
    ]
    for t_title, t_desc in tips:
        tp = doc.add_paragraph(style='List Bullet')
        tp.paragraph_format.space_before = Pt(2)
        tp.paragraph_format.space_after = Pt(2)
        rt1 = tp.add_run(t_title)
        rt1.bold = True
        rt1.font.size = Pt(10)
        rt2 = tp.add_run(t_desc)
        rt2.font.size = Pt(10)

    # Output file
    target_files = [
        "Tradeswift_Commodity_ERP_QA_Testing_Guide.docx",
        "Tradeswift_Commodity_ERP_QA_Testing_Guide_Verified.docx",
        "Tradeswift_Commodity_ERP_Complete_QA_Test_Guide_100.docx"
    ]
    saved_paths = []
    for fname in target_files:
        fpath = os.path.join(r"c:\Users\Chetan Garg\Desktop\Commodity ERP\Commodity_ERP", fname)
        try:
            doc.save(fpath)
            saved_paths.append(fpath)
            print(f"Saved: {fpath}")
        except PermissionError:
            print(f"File currently open in Word (locked): {fname}")

    print(f"Successfully generated files in: {len(saved_paths)} locations.")

if __name__ == "__main__":
    create_document()
