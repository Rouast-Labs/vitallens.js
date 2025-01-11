const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, '../examples')));

app.use('/dist', express.static(path.join(__dirname, '../dist')));

app.get('/:example', (req, res) => {
  const examplePath = path.join(__dirname, '../examples', `${req.params.example}.html`);
  res.sendFile(examplePath, (err) => {
    if (err) {
      res.status(404).send('Example not found');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  const exampleToOpen = process.env.EXAMPLE_TO_OPEN;
  if (exampleToOpen) {
    const url = `http://localhost:${PORT}/${exampleToOpen}`;
    // Open the browser based on OS
    const platform = process.platform;
    if (platform === 'win32') {
      exec(`start ${url}`);
    } else if (platform === 'darwin') {
      exec(`open ${url}`);
    } else {
      exec(`xdg-open ${url}`);
    }
  }
});
