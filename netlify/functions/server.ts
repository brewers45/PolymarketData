import serverless from 'serverless-http';
import { app } from '../../server/index';

export const handler = serverless(app);
