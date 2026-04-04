from src.lib.resend import resend_client, sender
from src.emails.email_templates import create_welcome_email_template

async def send_welcome_email(email: str, name: str, client_url: str) -> bool:
    try:
        html_content = create_welcome_email_template(name, client_url)
        response = await resend_client.send_email(from_email=f"{sender['name']} <{sender['email']}>", to_email=email, subject='Welcome to Chatify!', html=html_content)
        print(f'Welcome Email sent successfully to {email}: {response}')
        return True
    except Exception as error:
        print(f'Error sending welcome email: {error}')
        raise Exception('Failed to send welcome email')