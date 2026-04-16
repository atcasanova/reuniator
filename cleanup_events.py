#!/usr/bin/env python3
import sqlite3
import sys
import datetime
import os


def ensure_archive_table(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS EventArchive (
            id TEXT NOT NULL PRIMARY KEY,
            originalEventId TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            creatorName TEXT NOT NULL,
            timezone TEXT NOT NULL,
            createdAt DATETIME NOT NULL,
            lastScheduledDate TEXT,
            participantCount INTEGER NOT NULL DEFAULT 0,
            availabilityCount INTEGER NOT NULL DEFAULT 0,
            maintenanceDeletedAt DATETIME NOT NULL
        )
        """
    )


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 cleanup_events.py <caminho_para_o_banco_de_dados.db>")
        sys.exit(1)

    db_path = sys.argv[1]

    if not os.path.exists(db_path):
        print(f"Erro: O arquivo de banco de dados '{db_path}' não foi encontrado.")
        sys.exit(1)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Habilita suporte a chaves estrangeiras, caso o Prisma tenha configurado CASCADE a nível de banco
        cursor.execute("PRAGMA foreign_keys = ON")
        ensure_archive_table(cursor)

        # Calcula a data de 5 dias atrás (formato YYYY-MM-DD igual ao do banco)
        data_limite_obj = datetime.date.today() - datetime.timedelta(days=5)
        data_limite_str = data_limite_obj.strftime("%Y-%m-%d")

        # Busca eventos cuja MAIOR data de ocorrência em EventDay seja menor ou igual a 'data_limite_str'
        # Também pegará eventos que não possuam nenhum dia cadastrado (se isso for possível), limpando o lixo.
        query = """
        SELECT id FROM Event 
        WHERE id NOT IN (
            SELECT eventId FROM EventDay WHERE date > ?
        )
        """
        
        cursor.execute(query, (data_limite_str,))
        events_to_delete = [row[0] for row in cursor.fetchall()]

        if not events_to_delete:
            print(f"[{datetime.datetime.now()}] Nenhum evento para limpar. Todos têm datas futuras ou são recentes demais.")
            return

        print(f"[{datetime.datetime.now()}] Encontrados {len(events_to_delete)} evento(s) para exclusão cujo último dia passou de {data_limite_str}.")

        # Para garantir a exclusão em cascata correta, excluímos primeiro as dependências manuais,
        # pois versões diferentes do SQLite/Prisma podem agir de forma inconsistente com PRAGMA isoladamente.
        for event_id in events_to_delete:
            cursor.execute(
                """
                SELECT id, title, creatorName, timezone, createdAt
                FROM Event
                WHERE id = ?
                """,
                (event_id,),
            )
            event_row = cursor.fetchone()
            if not event_row:
                continue

            cursor.execute("SELECT MAX(date) FROM EventDay WHERE eventId = ?", (event_id,))
            last_scheduled_date = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM Participant WHERE eventId = ?", (event_id,))
            participant_count = cursor.fetchone()[0]
            cursor.execute(
                "SELECT COUNT(*) FROM Availability WHERE participantId IN (SELECT id FROM Participant WHERE eventId = ?)",
                (event_id,),
            )
            availability_count = cursor.fetchone()[0]

            archive_id = f"archive-{event_id}"
            cursor.execute(
                """
                INSERT OR REPLACE INTO EventArchive (
                    id, originalEventId, title, creatorName, timezone, createdAt,
                    lastScheduledDate, participantCount, availabilityCount, maintenanceDeletedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    archive_id,
                    event_row[0],
                    event_row[1],
                    event_row[2],
                    event_row[3],
                    event_row[4],
                    last_scheduled_date,
                    participant_count,
                    availability_count,
                    datetime.datetime.now().isoformat(timespec="seconds"),
                ),
            )

            # Apaga disponibilidades dos participantes deste evento
            cursor.execute("DELETE FROM Availability WHERE participantId IN (SELECT id FROM Participant WHERE eventId = ?)", (event_id,))
            # Apaga participantes
            cursor.execute("DELETE FROM Participant WHERE eventId = ?", (event_id,))
            # Apaga dias do evento
            cursor.execute("DELETE FROM EventDay WHERE eventId = ?", (event_id,))
            # Por fim, apaga o evento em si
            cursor.execute("DELETE FROM Event WHERE id = ?", (event_id,))

        conn.commit()
        print(f"[{datetime.datetime.now()}] Limpeza de {len(events_to_delete)} evento(s) concluída com sucesso.")

    except sqlite3.Error as e:
        print(f"[{datetime.datetime.now()}] Erro no SQLite: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Erro inesperado: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    main()
