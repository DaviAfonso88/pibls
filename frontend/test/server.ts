import { setupServer } from "msw/node";

// Os handlers de cada teste entram com server.use(...). Fixtures tipadas pelo OpenAPI vêm com a API.
export const server = setupServer();
