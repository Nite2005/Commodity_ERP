import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import sqlite3
import pymysql
from sqlalchemy import create_engine, text
from app.models import Base
import app.database  # noqa: F401

MYSQL_USER = "root"
MYSQL_PASS = "chetan123"
MYSQL_HOST = "localhost"
MYSQL_PORT = 3306
MYSQL_DB = "tradeswift_erp"

def main():
    print("1. Creating database in MySQL if not exists...")
    raw_conn = pymysql.connect(host=MYSQL_HOST, user=MYSQL_USER, password=MYSQL_PASS, port=MYSQL_PORT)
    with raw_conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    raw_conn.close()
    print(f"Database '{MYSQL_DB}' confirmed.")

    mysql_url = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASS}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}?charset=utf8mb4"
    mysql_engine = create_engine(mysql_url)

    print("2. Creating all schema tables in MySQL...")
    Base.metadata.create_all(bind=mysql_engine)
    print("Schema created.")

    print("3. Connecting to SQLite tradeswift_dev.db...")
    sqlite_conn = sqlite3.connect("tradeswift_dev.db")
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    # Get list of user tables in SQLite
    tables = [r[0] for r in sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';").fetchall()]
    print(f"Found {len(tables)} tables to migrate: {tables}")

    with mysql_engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        for table in tables:
            # Check if table exists in MySQL
            check_table = conn.execute(text(f"SHOW TABLES LIKE '{table}';")).fetchall()
            if not check_table:
                print(f"  Skipping {table} (not in MySQL models)")
                continue

            # Clear existing data in MySQL table to avoid duplicates
            conn.execute(text(f"DELETE FROM `{table}`;"))

            # Fetch columns and data from SQLite
            sqlite_cur.execute(f"SELECT * FROM `{table}`;")
            rows = sqlite_cur.fetchall()
            if not rows:
                print(f"  Table `{table}`: 0 rows")
                continue

            columns = [desc[0] for desc in sqlite_cur.description]
            
            # Filter columns that exist in the MySQL table
            mysql_cols_res = conn.execute(text(f"SHOW COLUMNS FROM `{table}`;")).fetchall()
            mysql_col_names = {row[0] for row in mysql_cols_res}
            valid_cols = [c for c in columns if c in mysql_col_names]

            col_names_str = ", ".join([f"`{c}`" for c in valid_cols])
            placeholders = ", ".join([f":{c}" for c in valid_cols])
            insert_sql = text(f"INSERT INTO `{table}` ({col_names_str}) VALUES ({placeholders})")

            # Prepare data
            data_to_insert = []
            for r in rows:
                row_dict = {c: r[c] for c in valid_cols}
                data_to_insert.append(row_dict)

            conn.execute(insert_sql, data_to_insert)
            print(f"  Table `{table}`: Migrated {len(data_to_insert)} rows successfully.")

        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

    sqlite_conn.close()
    print("\n4. Verification in MySQL:")
    with mysql_engine.connect() as conn:
        for table in tables:
            check_table = conn.execute(text(f"SHOW TABLES LIKE '{table}';")).fetchall()
            if check_table:
                cnt = conn.execute(text(f"SELECT COUNT(*) FROM `{table}`;")).scalar()
                print(f"  MySQL `{table}`: {cnt} rows")

    print("\nMigration completed successfully!")

if __name__ == "__main__":
    main()
