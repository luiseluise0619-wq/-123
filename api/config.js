export default function handler(req,res) {
  return res.status(200).json({reportEmailEnabled: process.env.REPORT_EMAIL_ENABLED === 'true' && !!process.env.BREVO_API_KEY && !!process.env.REPORT_FROM_EMAIL});
}
