# Styling Reference

## Color Palettes

### Corporate Blue (default)
```python
primary_color = colors.HexColor("#1A3C6B")
accent_color  = colors.HexColor("#2E86AB")
```

### Green / Sustainability
```python
primary_color = colors.HexColor("#1B5E20")
accent_color  = colors.HexColor("#43A047")
```

### Dark / Executive
```python
primary_color = colors.HexColor("#212121")
accent_color  = colors.HexColor("#FF6F00")
```

### Government / Institutional
```python
primary_color = colors.HexColor("#005A9C")
accent_color  = colors.HexColor("#C8A84B")
```

---

## Available Built-in Fonts (no install needed)

| Font name             | Use for         |
|-----------------------|-----------------|
| `Helvetica`           | Body text       |
| `Helvetica-Bold`      | Headings        |
| `Helvetica-Oblique`   | Captions, notes |
| `Times-Roman`         | Formal reports  |
| `Times-Bold`          | Formal headings |
| `Courier`             | Monospace / code|

To register a custom TTF font:
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("Inter", "Inter-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Inter-Bold", "Inter-Bold.ttf"))
```

---

## TableStyle Quick Snippets

### Right-align a numeric column (index 2)
```python
("ALIGN", (2, 1), (2, -1), "RIGHT"),
```

### Merge header cells (colspan)
```python
("SPAN", (0, 0), (2, 0)),  # Merge columns 0-2 in row 0
```

### Highlight a specific row (e.g., totals row at -1)
```python
("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E8F5E9")),
("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold"),
("LINEABOVE",  (0, -1), (-1, -1), 1.0, colors.HexColor("#43A047")),
```

### Fixed row height
```python
table = Table(rows, rowHeights=0.6*cm)
```

---

## Page Sizes

```python
from reportlab.lib.pagesizes import A4, A3, letter, landscape

A4                 # 595 x 842 pt  (portrait)
landscape(A4)      # 842 x 595 pt  (landscape)
letter             # 612 x 792 pt  (US Letter)
A3                 # 842 x 1191 pt
```

---

## Long Number Formatting in Tables

Use pandas before passing to `df_to_table`:
```python
df["valor"] = df["valor"].apply(lambda x: f"R$ {x:,.2f}")
df["data"]  = pd.to_datetime(df["data"]).dt.strftime("%d/%m/%Y")
```

---

## Multi-line Header Cells

Pass a `Paragraph` inside the header row for line wrapping:
```python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()
header_para = Paragraph("<b>Descrição<br/>do Produto</b>", styles["Normal"])
rows = [[header_para, "Qtd", "Valor"]] + data_rows
```
