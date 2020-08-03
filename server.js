const path = require('path');
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);
const PORT = 8080;

const {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
    isHost,
  } = require('./client/src/utils/users');



const botName = 'TeamStream Bot';

io.on("connection", socket => {
    // socket.emit("your id", socket.id);
    // socket.on("send message", body => {
    //     io.emit("message", body)
    // })
    socket.on('joinRoom', ({ username, room }) => {
        const user = userJoin(socket.id, username, room);
    
        socket.join(user.room);
    
        // Welcome current user
        // only to the user who just joined
        socket.emit('message', formatMessage(botName, 'Welcome to ChatCord!'));
    
        // Broadcast when a user connects
        // to everyone except the person who just joined
        
        socket.broadcast
          .to(user.room)
          .emit(
            'message',
            formatMessage(botName, `${user.username} has joined the chat`)
          );
    
        // Send users and room info
        //to everyone
        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users: getRoomUsers(user.room)
        });
      });
    //   socket.on("currentHostTime", time => {
       
    //     socket.broadcast
    //     .emit("currentHostTime", time)
    //   })
    
      // Listen for chatMessage
      socket.on('chatMessage', msg => {
        const user = getCurrentUser(socket.id);
    
        io.to(user.room).emit('message', formatMessage(user.username, msg));
      });
    
      // Runs when client disconnects
      socket.on('disconnect', () => {
        const user = userLeave(socket.id);
    
        if (user) {
          io.to(user.room).emit(
            'message',
            formatMessage(botName, `${user.username} has left the chat`)
          );
    
          // Send users and room info
          io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
          });
        }
      });
})


server.listen(PORT, () => console.log(`server is running on port ${PORT}`));