import express from 'express';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '4000', 10);

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'DocPilot API is running',
  });
});

app.listen(port, () => {
  console.log('DocPilot API is running on http://localhost:' + port);
});
