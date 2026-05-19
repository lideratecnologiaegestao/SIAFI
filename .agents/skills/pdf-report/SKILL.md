---
name: pdf-report
description: >
  Use this skill to generate professional PDF reports that pull data from a database
  (SQLite, PostgreSQL, MySQL, or any SQLAlchemy-supported database) and render it
  with a standardized header (logo, title, date) and footer (page numbers, company
  info). Trigger this skill whenever the user wants to: create a PDF report from
  database data, export query results as a formatted PDF, produce reports with
  consistent branding (header/footer), generate paginated data tables in PDF format,
  or automate report generation from any SQL database. Also use when the user asks
  for "relatório PDF", "relatório com cabeçalho e rodapé", "exportar dados para PDF"
  or any similar variant. Always use this skill — not generic PDF generation — when
  database connectivity and branded report layout are both required.
---

# PDF Report Skill — Database → Branded PDF

Generate professional PDF reports from database queries, with a configurable
standard header (logo, report title, generation date) and footer (page number,
company name, confidentiality notice).

## Library Stack

| Library | Role |
|---------|------|
| `reportlab` | Core PDF engine (Platypus flowables + canvas) |
| `sqlalchemy` | Database adapter (SQLite, PostgreSQL, MySQL, etc.) |
| `pandas` | Optional — tabular data manipulation before rendering |

Install:
```bash
pip install reportlab sqlalchemy pandas --break-system-packages
```

---

## Architecture Overview

```
Database ──(SQLAlchemy)──► DataFrame ──(ReportLab Platypus)──► PDF
                                          ↑
                              Header / Footer canvas callbacks
```

Three moving parts:

1. **`ReportConfig`** — holds branding, DB connection string, margins, colors.
2. **`header_footer_canvas(canvas, doc)`** — callback drawn on every page.
3. **`build_report(config, sections)`** — orchestrates query → flowable → PDF.

---

## Core Template

See `scripts/report_template.py` for the full production template.
Below is the minimal working skeleton:

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas as rl_canvas
from sqlalchemy import create_engine, text
import pandas as pd
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class ReportConfig:
    title: str = "Relatório"
    subtitle: str = ""
    company_name: str = "Minha Empresa"
    logo_path: Optional[str] = None          # path to PNG/JPG logo
    db_url: str = "sqlite:///data.db"        # SQLAlchemy connection string
    output_path: str = "relatorio.pdf"
    confidential_text: str = "Confidencial"
    primary_color: colors.Color = field(default_factory=lambda: colors.HexColor("#1A3C6B"))
    accent_color: colors.Color = field(default_factory=lambda: colors.HexColor("#2E86AB"))
    page_size: tuple = A4
    top_margin: float = 3.5 * cm            # space reserved for header
    bottom_margin: float = 2.5 * cm         # space reserved for footer
    left_margin: float = 2.0 * cm
    right_margin: float = 2.0 * cm

# ── Header / Footer callback ──────────────────────────────────────────────────

def make_header_footer(config: ReportConfig):
    """Returns a canvas callback that draws header + footer on every page."""
    def _draw(canvas, doc):
        canvas.saveState()
        W, H = config.page_size

        # ── HEADER ──────────────────────────────────────────────────────
        # Colored bar
        canvas.setFillColor(config.primary_color)
        canvas.rect(0, H - 2.8*cm, W, 2.8*cm, fill=1, stroke=0)

        # Logo (if provided)
        x_text_start = config.left_margin
        if config.logo_path:
            try:
                canvas.drawImage(
                    config.logo_path, config.left_margin,
                    H - 2.4*cm, width=3*cm, height=1.8*cm,
                    preserveAspectRatio=True, mask='auto'
                )
                x_text_start = config.left_margin + 3.5*cm
            except Exception:
                pass  # logo missing — silently skip

        # Title
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(x_text_start, H - 1.4*cm, config.title)

        # Subtitle / date
        canvas.setFont("Helvetica", 9)
        canvas.drawString(
            x_text_start, H - 2.1*cm,
            f"{config.subtitle}   |   Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )

        # Company name (right-aligned)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawRightString(W - config.right_margin, H - 1.6*cm, config.company_name)

        # ── FOOTER ──────────────────────────────────────────────────────
        # Separator line
        canvas.setStrokeColor(config.accent_color)
        canvas.setLineWidth(0.8)
        canvas.line(config.left_margin, 1.8*cm, W - config.right_margin, 1.8*cm)

        # Confidential label (left)
        canvas.setFillColor(colors.grey)
        canvas.setFont("Helvetica-Oblique", 8)
        canvas.drawString(config.left_margin, 0.9*cm, config.confidential_text)

        # Company (center)
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(W / 2, 0.9*cm, config.company_name)

        # Page number (right)
        canvas.drawRightString(
            W - config.right_margin, 0.9*cm,
            f"Página {doc.page}"
        )
        canvas.restoreState()

    return _draw

# ── Table helper ─────────────────────────────────────────────────────────────

def df_to_table(df: pd.DataFrame, config: ReportConfig) -> Table:
    """Converts a DataFrame to a styled ReportLab Table."""
    header = [str(c) for c in df.columns]
    rows = [header] + df.astype(str).values.tolist()

    col_count = len(header)
    page_width = config.page_size[0] - config.left_margin - config.right_margin
    col_width = page_width / col_count

    table = Table(rows, colWidths=[col_width] * col_count, repeatRows=1)
    table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), config.primary_color),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 9),
        ("ALIGN",      (0, 0), (-1, 0), "CENTER"),
        # Data rows
        ("FONTNAME",   (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",   (0, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0F4F8")]),
        ("ALIGN",      (0, 1), (-1, -1), "LEFT"),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        # Borders
        ("GRID",       (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table

# ── Main builder ─────────────────────────────────────────────────────────────

def build_report(config: ReportConfig, sections: list) -> str:
    """
    sections: list of dicts:
      { "title": str, "query": str, "description": str (optional) }
    Returns output path.
    """
    styles = getSampleStyleSheet()
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        textColor=config.primary_color,
        spaceBefore=12,
        spaceAfter=6,
        fontSize=12,
        leading=16,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"], fontSize=9, leading=13
    )

    doc = SimpleDocTemplate(
        config.output_path,
        pagesize=config.page_size,
        topMargin=config.top_margin,
        bottomMargin=config.bottom_margin,
        leftMargin=config.left_margin,
        rightMargin=config.right_margin,
    )

    engine = create_engine(config.db_url)
    story = []

    for i, section in enumerate(sections):
        # Section heading
        story.append(Paragraph(section["title"], heading_style))
        if section.get("description"):
            story.append(Paragraph(section["description"], body_style))
            story.append(Spacer(1, 0.3*cm))

        # Query database
        with engine.connect() as conn:
            df = pd.read_sql(text(section["query"]), conn)

        if df.empty:
            story.append(Paragraph("Nenhum dado encontrado.", body_style))
        else:
            story.append(df_to_table(df, config))

        story.append(Spacer(1, 0.5*cm))

        # Page break between sections (except last)
        if i < len(sections) - 1:
            story.append(PageBreak())

    doc.build(story, onFirstPage=make_header_footer(config),
              onLaterPages=make_header_footer(config))
    return config.output_path
```

---

## Usage Example

```python
config = ReportConfig(
    title="Relatório de Vendas",
    subtitle="Período: Janeiro – Junho 2025",
    company_name="Acme S.A.",
    logo_path="logo.png",              # optional
    db_url="postgresql://user:pw@localhost/mydb",
    output_path="vendas_2025.pdf",
    confidential_text="Uso interno",
    primary_color=colors.HexColor("#1A3C6B"),
    accent_color=colors.HexColor("#2E86AB"),
)

sections = [
    {
        "title": "Resumo de Vendas por Região",
        "query": "SELECT regiao, COUNT(*) AS pedidos, SUM(valor) AS total FROM vendas GROUP BY regiao ORDER BY total DESC",
        "description": "Consolidado de pedidos e receita por região no período.",
    },
    {
        "title": "Top 10 Produtos",
        "query": "SELECT produto, quantidade, receita FROM top_produtos LIMIT 10",
    },
]

output = build_report(config, sections)
print(f"Relatório salvo em: {output}")
```

---

## Database Connection Strings

| Banco | `db_url` |
|-------|----------|
| SQLite (arquivo) | `sqlite:///caminho/para/base.db` |
| SQLite (memória) | `sqlite:///:memory:` |
| PostgreSQL | `postgresql://user:senha@host:5432/db` |
| MySQL / MariaDB | `mysql+pymysql://user:senha@host/db` |
| SQL Server | `mssql+pyodbc://user:senha@host/db?driver=ODBC+Driver+17+for+SQL+Server` |

---

## Column Width Customization

For tables with very different column types, specify widths explicitly:

```python
# Override df_to_table to pass custom widths
table = Table(rows, colWidths=[4*cm, 8*cm, 3*cm, 3*cm], repeatRows=1)
```

---

## Adding Charts (optional)

Use `reportlab.graphics` with `Drawing` + `VerticalBarChart`:

```python
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart

def make_bar_chart(labels, values, width=14*cm, height=7*cm):
    d = Drawing(width, height)
    chart = VerticalBarChart()
    chart.x, chart.y = 50, 50
    chart.width = width - 70
    chart.height = height - 70
    chart.data = [values]
    chart.categoryAxis.categoryNames = labels
    d.add(chart)
    return d
```

Then insert `make_bar_chart(...)` into `story` like any other flowable.

---

## Checklist Before Running

- [ ] Install dependencies: `pip install reportlab sqlalchemy pandas --break-system-packages`
- [ ] Confirm `db_url` (test with `engine.connect()` first)
- [ ] Confirm queries return data (`pd.read_sql` test)
- [ ] Logo file exists at `logo_path` (or set to `None`)
- [ ] Output path is writable
- [ ] Copy final file to `/mnt/user-data/outputs/` and call `present_files`

---

## Reference Files

- `scripts/report_template.py` — Full production-ready template (copy & run)
- `references/styling.md` — Color palette, font options, advanced table styles
- `references/db_patterns.md` — Common DB connection patterns and query helpers
