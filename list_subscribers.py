from app import app, db, Subscriber

def list_subs():
    with app.app_context():
        subscribers = Subscriber.query.all()
        print(f"Total de inscritos: {len(subscribers)}")
        print("-" * 30)
        for sub in subscribers:
            print(f"ID: {sub.id} | Empresa: {sub.empresa} | Email: {sub.email} | WhatsApp: {sub.whatsapp}")
        print("-" * 30)

if __name__ == "__main__":
    list_subs()
