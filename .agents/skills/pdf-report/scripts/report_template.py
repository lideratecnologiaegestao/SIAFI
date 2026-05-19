"""
report_template.py — PDF Report Generator (production template)

Usage:
    python report_template.py

Adjust ReportConfig and SECTIONS at the bottom of this file.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from sqlalchemy import create_engine, text
import pandas as pd
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import os

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ReportConfig:
    # Branding
    title: str = "Relatório"
    subtitle: str = ""
    company_name: str = "Minha Empresa"
    logo_path: Optional[str] = None
    confidential_text: str = "Confidencial — Uso interno"

    # Database
    db_url: str = "sqlite:///data.db"

    # Output
    output_path: str = "relatorio.pdf"

    # Colors
    primary_color: colors.Color = field(
        default_factory=lambda: colors.HexColor("#1A3C6B")
    )
    accent_color: colors.Color = field(
        default_factory=lambda: colors.HexColor("#2E86AB")
    )
    header_text_color: colors.Color = field(
        default_factory=lambda: colors.white
    )

    # Page layout
    page_size: tuple = A4
    top_margin: float = 3.5 * cm
    bottom_margin: float = 2.5 * cm
    left_margin: float = 2.0 * cm
    right_margin: float = 2.0 * cm

    # Table styling
    header_row_color: colors.Color = field(
        default_factory=lambda: colors.HexColor("#1A3C6B")
    )
    alt_row_color: colors.Color = field(
        default_factory=lambda: colors.HexColor("#F0F4F8")
    )
    grid_color: colors.Color = field(
        default_factory=lambda: colors.HexColor("#CCCCCC")
    )


# ─────────────────────────────────────────────────────────────────────────────
# HEADER / FOOTER CANVAS CALLBACK
# ─────────────────────────────────────────────────────────────────────────────

def make_header_footer(config: ReportConfig):
    """
    Returns a ReportLab canvas callback that paints the header and footer
    on every page (both onFirstPage and onLaterPages).
    """
    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M")

    def _draw(canvas, doc):
        canvas.saveState()
        W, H = config.page_size

        # ── HEADER BAR ────────────────────────────────────────────────────
        canvas.setFillColor(config.primary_color)
        canvas.rect(0, H - 2.8 * cm, W, 2.8 * cm, fill=1, stroke=0)

        x_text = config.left_margin

        # Logo
        if config.logo_path and os.path.isfile(config.logo_path):
            try:
                canvas.drawImage(
                    config.logo_path,
                    config.left_margin,
                    H - 2.5 * cm,
                    width=3 * cm,
                    height=2.0 * cm,
                    preserveAspectRatio=True,
                    mask="auto",
                )
                x_text = config.left_margin + 3.5 * cm
            except Exception:
                pass

        # Report title
        canvas.setFillColor(config.header_text_color)
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(x_text, H - 1.35 * cm, config.title)

        # Subtitle + generation date
        canvas.setFont("Helvetica", 8.5)
        subtitle_line = config.subtitle
        if subtitle_line:
            subtitle_line += "   |   "
        subtitle_line += f"Gerado em: {generated_at}"
        canvas.drawString(x_text, H - 2.1 * cm, subtitle_line)

        # Company name (right side)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawRightString(
            W - config.right_margin, H - 1.6 * cm, config.company_name
        )

        # ── FOOTER ────────────────────────────────────────────────────────
        # Separator line
        canvas.setStrokeColor(config.accent_color)
        canvas.setLineWidth(0.8)
        canvas.line(
            config.left_margin, 1.8 * cm,
            W - config.right_margin, 1.8 * cm
        )

        canvas.setFillColor(colors.HexColor("#555555"))

        # Confidential label (left)
        canvas.setFont("Helvetica-Oblique", 7.5)
        canvas.drawString(config.left_margin, 0.9 * cm, config.confidential_text)

        # Company (center)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawCentredString(W / 2, 0.9 * cm, config.company_name)

        # Page number (right)
        canvas.drawRightString(
            W - config.right_margin, 0.9 * cm,
            f"Página {doc.page}"
        )

        canvas.restoreState()

    return _draw


# ─────────────────────────────────────────────────────────────────────────────
# TABLE BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def df_to_table(
    df: pd.DataFrame,
    config: ReportConfig,
    col_widths: Optional[List[float]] = None,
    align_map: Optional[Dict[str, str]] = None,
) -> Table:
    """
    Converts a pandas DataFrame to a styled ReportLab Table.

    Args:
        df:          Data to render.
        config:      ReportConfig for colors.
        col_widths:  Optional list of explicit column widths in points.
        align_map:   Optional dict {column_name: "LEFT"|"RIGHT"|"CENTER"}.
    """
    page_width = (
        config.page_size[0] - config.left_margin - config.right_margin
    )

    # Build rows
    header = list(df.columns)
    data_rows = df.astype(str).values.tolist()
    all_rows = [header] + data_rows

    # Column widths
    if col_widths is None:
        col_widths = [page_width / len(header)] * len(header)

    table = Table(all_rows, colWidths=col_widths, repeatRows=1)

    style_commands = [
        # Header
        ("BACKGROUND",     (0, 0), (-1, 0), config.header_row_color),
        ("TEXTCOLOR",      (0, 0), (-1, 0), colors.white),
        ("FONTNAME",       (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",       (0, 0), (-1, 0), 8.5),
        ("ALIGN",          (0, 0), (-1, 0), "CENTER"),
        ("VALIGN",         (0, 0), (-1, 0), "MIDDLE"),
        ("TOPPADDING",     (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING",  (0, 0), (-1, 0), 5),
        # Data rows
        ("FONTNAME",       (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",       (0, 1), (-1, -1), 8),
        ("ALIGN",          (0, 1), (-1, -1), "LEFT"),
        ("VALIGN",         (0, 1), (-1, -1), "MIDDLE"),
        ("TOPPADDING",     (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING",  (0, 1), (-1, -1), 3),
        # Alternating rows
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, config.alt_row_color]),
        # Grid
        ("GRID",           (0, 0), (-1, -1), 0.4, config.grid_color),
        ("LINEBELOW",      (0, 0), (-1, 0), 1.2, config.accent_color),
    ]

    # Custom per-column alignment
    if align_map:
        for col_name, alignment in align_map.items():
            if col_name in header:
                col_idx = header.index(col_name)
                style_commands.append(
                    ("ALIGN", (col_idx, 1), (col_idx, -1), alignment)
                )

    table.setStyle(TableStyle(style_commands))
    return table


# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: BAR CHART
# ─────────────────────────────────────────────────────────────────────────────

def make_bar_chart(
    labels: List[str],
    values: List[float],
    chart_title: str = "",
    width: float = 14 * cm,
    height: float = 7 * cm,
    bar_color: colors.Color = colors.HexColor("#2E86AB"),
) -> Drawing:
    """Returns a ReportLab Drawing containing a vertical bar chart."""
    d = Drawing(width, height)

    chart = VerticalBarChart()
    chart.x = 50
    chart.y = 40
    chart.width = width - 70
    chart.height = height - 60

    chart.data = [values]
    chart.categoryAxis.categoryNames = labels
    chart.bars[0].fillColor = bar_color
    chart.bars[0].strokeColor = None
    chart.valueAxis.valueMin = 0
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.labels.fontSize = 8

    if chart_title:
        from reportlab.graphics.shapes import String
        d.add(String(
            width / 2, height - 10,
            chart_title,
            textAnchor="middle",
            fontSize=10,
            fontName="Helvetica-Bold",
        ))

    d.add(chart)
    return d


# ─────────────────────────────────────────────────────────────────────────────
# MAIN REPORT BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_report(config: ReportConfig, sections: List[Dict[str, Any]]) -> str:
    """
    Builds the PDF report.

    sections is a list of dicts with the following keys:
        title       (str)  Required. Section heading.
        query       (str)  Required. SQL query to run.
        description (str)  Optional. Narrative text above the table.
        col_widths  (list) Optional. List of column widths in points.
        align_map   (dict) Optional. {col_name: "LEFT"|"RIGHT"|"CENTER"}.
        chart       (dict) Optional. {"labels_col": str, "values_col": str,
                                      "chart_title": str}
        page_break  (bool) Optional. Force page break BEFORE this section.
                           Default: True for sections after the first.
    """
    styles = getSampleStyleSheet()

    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        textColor=config.primary_color,
        spaceBefore=14,
        spaceAfter=6,
        fontSize=12,
        leading=16,
        fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        spaceAfter=4,
    )
    summary_style = ParagraphStyle(
        "Summary",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#555555"),
        spaceAfter=6,
    )

    doc = SimpleDocTemplate(
        config.output_path,
        pagesize=config.page_size,
        topMargin=config.top_margin,
        bottomMargin=config.bottom_margin,
        leftMargin=config.left_margin,
        rightMargin=config.right_margin,
        title=config.title,
        author=config.company_name,
    )

    engine = create_engine(config.db_url)
    story = []
    cb = make_header_footer(config)

    for i, section in enumerate(sections):
        # Page break (default on every section after the first)
        wants_break = section.get("page_break", i > 0)
        if wants_break and i > 0:
            story.append(PageBreak())

        # Section heading
        story.append(Paragraph(section["title"], heading_style))
        story.append(
            HRFlowable(
                width="100%", thickness=0.6,
                color=config.accent_color, spaceAfter=4
            )
        )

        # Optional description
        if section.get("description"):
            story.append(Paragraph(section["description"], body_style))
            story.append(Spacer(1, 0.3 * cm))

        # Query
        with engine.connect() as conn:
            df = pd.read_sql(text(section["query"]), conn)

        if df.empty:
            story.append(
                Paragraph("Nenhum dado encontrado para esta consulta.", body_style)
            )
            continue

        # Summary line
        story.append(
            Paragraph(
                f"{len(df)} registro(s) encontrado(s).", summary_style
            )
        )

        # Optional bar chart
        if section.get("chart"):
            chart_cfg = section["chart"]
            labels = df[chart_cfg["labels_col"]].astype(str).tolist()
            values = df[chart_cfg["values_col"]].astype(float).tolist()
            story.append(
                make_bar_chart(
                    labels, values,
                    chart_title=chart_cfg.get("chart_title", ""),
                    bar_color=config.accent_color,
                )
            )
            story.append(Spacer(1, 0.4 * cm))

        # Table
        story.append(
            df_to_table(
                df, config,
                col_widths=section.get("col_widths"),
                align_map=section.get("align_map"),
            )
        )
        story.append(Spacer(1, 0.5 * cm))

    doc.build(story, onFirstPage=cb, onLaterPages=cb)
    engine.dispose()
    return config.output_path


# ─────────────────────────────────────────────────────────────────────────────
# DEMO — creates a sample SQLite DB and generates a report
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sqlite3

    # Create demo database
    conn = sqlite3.connect("demo.db")
    conn.executescript("""
        DROP TABLE IF EXISTS vendas;
        CREATE TABLE vendas (
            id INTEGER PRIMARY KEY,
            produto TEXT,
            regiao TEXT,
            quantidade INTEGER,
            valor REAL,
            data TEXT
        );
        INSERT INTO vendas VALUES
            (1,'Produto A','Norte',   10, 1500.00,'2025-01-15'),
            (2,'Produto B','Sul',      5,  850.50,'2025-01-20'),
            (3,'Produto A','Leste',   12, 1800.00,'2025-02-03'),
            (4,'Produto C','Norte',    8,  640.00,'2025-02-10'),
            (5,'Produto B','Oeste',    3,  510.75,'2025-03-01'),
            (6,'Produto A','Sul',     20, 3000.00,'2025-03-15'),
            (7,'Produto C','Leste',    6,  480.00,'2025-04-02'),
            (8,'Produto B','Norte',   11, 1870.50,'2025-04-20');
    """)
    conn.commit()
    conn.close()

    # Configure report
    config = ReportConfig(
        title="Relatório de Vendas 2025",
        subtitle="Janeiro – Abril 2025",
        company_name="Demo S.A.",
        logo_path=None,
        db_url="sqlite:///demo.db",
        output_path="/mnt/user-data/outputs/relatorio_demo.pdf",
        confidential_text="Uso interno — não distribuir",
        primary_color=colors.HexColor("#1A3C6B"),
        accent_color=colors.HexColor("#2E86AB"),
    )

    sections = [
        {
            "title": "Vendas por Produto",
            "description": "Quantidade total e receita bruta agrupadas por produto.",
            "query": (
                "SELECT produto, SUM(quantidade) AS qtd_total, "
                "ROUND(SUM(valor),2) AS receita_total "
                "FROM vendas GROUP BY produto ORDER BY receita_total DESC"
            ),
            "chart": {
                "labels_col": "produto",
                "values_col": "receita_total",
                "chart_title": "Receita por Produto (R$)",
            },
            "align_map": {"qtd_total": "RIGHT", "receita_total": "RIGHT"},
        },
        {
            "title": "Vendas por Região",
            "description": "Desempenho regional no período.",
            "query": (
                "SELECT regiao, COUNT(*) AS pedidos, "
                "ROUND(SUM(valor),2) AS total "
                "FROM vendas GROUP BY regiao ORDER BY total DESC"
            ),
            "align_map": {"pedidos": "RIGHT", "total": "RIGHT"},
        },
        {
            "title": "Detalhe de Transações",
            "description": "Lista completa de vendas registradas.",
            "query": "SELECT id, produto, regiao, quantidade, valor, data FROM vendas ORDER BY data",
            "align_map": {"id": "RIGHT", "quantidade": "RIGHT", "valor": "RIGHT"},
            "page_break": True,
        },
    ]

    out = build_report(config, sections)
    print(f"✅  Relatório gerado: {out}")
