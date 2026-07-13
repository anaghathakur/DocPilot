import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '4000', 10);
const app = createApp();

app.listen(port, () => {
  console.log('DocPilot API is running on http://localhost:' + port);
});
