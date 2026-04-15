#!/usr/bin/env python3
import sqlite3
import sys
import datetime
import os

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
