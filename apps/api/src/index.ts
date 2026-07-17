import 'dotenv/config';

import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '4000', 10);
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log('DocPilot API is running on port ' + port);
});
