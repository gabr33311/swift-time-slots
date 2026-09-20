import { createFileRoute } from '@tanstack/react-router'

// Rota neutralizada (Independência do Lovable)
// O código original de acesso à API foi removido. 
// Esta rota agora apenas devolve um erro 404, fechando a ligação
// aos servidores externos e protegendo os templates.

export const Route = createFileRoute("/lovable/email/transactional/preview")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          { error: 'Endpoint desativado por segurança.' },
          { status: 404 }
        )
      },
    },
  },
})
