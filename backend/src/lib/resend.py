from src.lib.config import config
import httpx
import asyncio

class ResendClient:

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = 'https://api.resend.com/emails'

    async def send_email(self, from_email: str, to_email: str, subject: str, html: str):
        try:
            headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
            payload = {'from': from_email, 'to': to_email, 'subject': subject, 'html': html}
            async with httpx.AsyncClient() as client:
                response = await client.post(self.api_url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f'Error sending email via Resend: {e}')
            raise
resend_client = ResendClient(api_key=config.RESEND_API_KEY)
sender = {'email': config.EMAIL_FROM, 'name': config.EMAIL_FROM_NAME}