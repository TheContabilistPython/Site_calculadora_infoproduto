import csv
import sys
from app import app, Subscriber

def export_csv():
    with app.app_context():
        subscribers = Subscriber.query.all()
        # Escreve no stdout para que possa ser redirecionado para um arquivo local
        writer = csv.writer(sys.stdout)
        
        # Cabeçalho
        writer.writerow(['ID', 'Empresa', 'Email', 'WhatsApp', 'Consentimento', 'Confirmado', 'Data Confirmacao'])
        
        for sub in subscribers:
            writer.writerow([
                sub.id, 
                sub.empresa, 
                sub.email, 
                sub.whatsapp, 
                'Sim' if sub.consent else 'Nao', 
                'Sim' if sub.confirmed else 'Nao',
                sub.confirm_token # Usando token como proxy de data se não tiver campo de data explicito, ou deixar vazio
            ])

if __name__ == "__main__":
    export_csv()
