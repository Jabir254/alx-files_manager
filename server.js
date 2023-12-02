const express = require('express');

const app = express();
const port = process.env.DB_PORT || 5000;

app.use('/', require('./routes'));

app.listen(port, () => {
  console.log(`connected succefuly on port ${5000}`);
});
