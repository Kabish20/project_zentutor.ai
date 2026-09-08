import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_todos():
    try:
        response = supabase.table('todos').select("*").execute()
        print("Connected to Supabase! Todos:", response.data)
        return response.data
    except Exception as e:
        print("Connected to Supabase, but could not read 'todos' table.")
        print("Details:", e)
        print("\nTip: In your Supabase Dashboard (https://supabase.com/dashboard), go to the Table Editor and create the 'todos' table with a 'name' column if you want to follow the quickstart tutorial.")
        return []

if __name__ == '__main__':
    print(f"Connecting to: {SUPABASE_URL}")
    get_todos()

