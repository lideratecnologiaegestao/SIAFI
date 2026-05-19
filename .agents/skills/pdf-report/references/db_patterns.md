# Database Patterns Reference

## Connection Strings

| Banco           | db_url                                                                  |
|-----------------|-------------------------------------------------------------------------|
| SQLite (arquivo)| `sqlite:///caminho/relativo/base.db`                                    |
| SQLite (absoluto)| `sqlite:////home/user/data/base.db`                                    |
| PostgreSQL      | `postgresql://usuario:senha@host:5432/banco`                           |
| MySQL / MariaDB | `mysql+pymysql://usuario:senha@host:3306/banco`                        |
| SQL Server      | `mssql+pyodbc://user:pw@host/db?driver=ODBC+Driver+17+for+SQL+Server`  |
| Oracle          | `oracle+cx_oracle://user:pw@host:1521/?service_name=ORCL`              |

Extra drivers:
```bash
pip install psycopg2-binary   # PostgreSQL
pip install pymysql           # MySQL/MariaDB
pip install pyodbc            # SQL Server
```

---

## Parameterized Queries (safe, no SQL injection)

```python
from sqlalchemy import text

params = {"inicio": "2025-01-01", "fim": "2025-06-30", "regiao": "Norte"}

query = text("""
    SELECT produto, SUM(valor) AS total
    FROM vendas
    WHERE data BETWEEN :inicio AND :fim
      AND regiao = :regiao
    GROUP BY produto
""")

with engine.connect() as conn:
    df = pd.read_sql(query, conn, params=params)
```

---

## Testing Connection Before Building Report

```python
from sqlalchemy import create_engine, text

def test_connection(db_url: str) -> bool:
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Conexão OK")
        return True
    except Exception as e:
        print(f"❌ Falha na conexão: {e}")
        return False
```

---

## Listing Tables (SQLite)

```python
with engine.connect() as conn:
    tables = pd.read_sql(
        text("SELECT name FROM sqlite_master WHERE type='table'"), conn
    )
print(tables)
```

---

## Preview Query Results Before Generating PDF

Always validate before building:
```python
with engine.connect() as conn:
    df = pd.read_sql(text(MY_QUERY), conn)

print(df.shape)       # (rows, cols)
print(df.head())
print(df.dtypes)
```

---

## Adding a Totals Row

```python
totals = df[["quantidade", "valor"]].sum()
totals_row = pd.DataFrame(
    [["TOTAL", "", totals["quantidade"], totals["valor"]]],
    columns=df.columns
)
df_with_total = pd.concat([df, totals_row], ignore_index=True)
```

---

## Handling NULL Values

```python
df = df.fillna("—")                         # replace NaN with dash
df["data"] = df["data"].fillna("Sem data")  # per-column fill
```
