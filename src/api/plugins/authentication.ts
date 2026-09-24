import type { FastifyReply, FastifyRequest } from "fastify";

export function createAuthentication(apiKey: string) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    if (request.headers.authorization === `Bearer ${apiKey}`) {
      return;
    }

    return reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "No autorizado"
    });
  };
}
