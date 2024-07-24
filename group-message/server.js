const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const EventEmitter = require('events');
const admin = require('firebase-admin');

const serviceAccount = require('./firebaseServiceKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

const app = express();
const port = 3000;
const eventEmitter = new EventEmitter();

app.use(bodyParser.json());

const wss = new WebSocket.Server({ port: 8080 });

let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('Client connected');

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    console.log('Client disconnected');
  });
});

const broadcastWithDelay = (data, delay) => {
  clients.forEach((client, index) => {
    setTimeout(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    }, index * delay);
  });
};


app.post('/webhook', async (req, res) => {
  try {
    const messages = req.body.messages;
    if (messages && messages.length > 0) {
      const batch = firestore.batch();

      messages.forEach(message => {
        const { messageId, status, contact, dateTime, authorName, chatId } = message;
        if (authorName === "Admin") {
          const eventData = {
            messages: [
              { messageId, status }
            ]
          };

          eventEmitter.emit('webhook-event', eventData);
          broadcastWithDelay(eventData, 1000);

          const docRef = firestore.collection('webhookData').doc(messageId);
          batch.set(docRef, {
            messageId: messageId,
            status: status,
            contact: contact,
            dateTime: dateTime,
            authorName: authorName,
            chatId: chatId
          });

          console.log(`Message sent on ${dateTime} with contact ${JSON.stringify(contact.name)} with ID ${messageId} has status: ${status}`);
        }
      });
      await batch.commit();

      res.sendStatus(200);
    } else {
      res.status(400).send('No messages in request');
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
