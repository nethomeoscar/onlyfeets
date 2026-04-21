// config/email.ts
import sgMail from '@sendgrid/mail';
import { logger } from './logger';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

const TEMPLATES: Record<string, (data: any) => string> = {
  'email-verification': (d) => `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:40px;background:#0f0f1a;color:#fff;border-radius:16px">
      <h1 style="color:#ec4899;margin-bottom:8px">¡Bienvenida a OnlyFeets! 🦶</h1>
      <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Hola <strong>${d.username}</strong>, gracias por unirte.</p>
      <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Por favor verifica tu correo electrónico haciendo clic en el botón de abajo:</p>
      <a href="${d.verificationUrl}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px">
        Verificar email
      </a>
      <p style="color:rgba(255,255,255,0.4);margin-top:24px;font-size:12px">Este enlace expira en 24 horas.</p>
    </div>
  `,
  'password-reset': (d) => `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:40px;background:#0f0f1a;color:#fff;border-radius:16px">
      <h1 style="color:#ec4899;margin-bottom:8px">Restablecer contraseña</h1>
      <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Hola <strong>${d.username}</strong>,</p>
      <p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, ignora este email.</p>
      <a href="${d.resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px">
        Restablecer contraseña
      </a>
      <p style="color:rgba(255,255,255,0.4);margin-top:24px;font-size:12px">Este enlace expira en 1 hora.</p>
    </div>
  `,
  'new-subscriber': (d) => `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:40px;background:#0f0f1a;color:#fff;border-radius:16px">
      <h1 style="color:#ec4899;margin-bottom:8px">¡Nueva suscriptora! 🎉</h1>
      <p style="color:rgba(255,255,255,0.7)">Tienes ${d.subscriberCount} suscriptoras activas.</p>
    </div>
  `,
};

export const sendEmail = async ({ to, subject, template, data }: SendEmailOptions) => {
  if (!process.env.SENDGRID_API_KEY) {
    logger.debug(`Email (dev): ${subject} → ${to}`);
    return;
  }

  try {
    const html = TEMPLATES[template]?.(data) ?? `<p>${JSON.stringify(data)}</p>`;
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL!, name: process.env.SENDGRID_FROM_NAME || 'OnlyFeets' },
      subject,
      html,
    });
    logger.info(`Email sent: ${subject} → ${to}`);
  } catch (error) {
    logger.error('Email send error', error);
  }
};
