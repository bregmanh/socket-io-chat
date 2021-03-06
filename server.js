const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const toxicity = require('@tensorflow-models/toxicity');
const tfjs = require("@tensorflow/tfjs-node");
const { kStringMaxLength } = require("buffer");
const io = socket(server);
io.origins('localhost:3002') // for development mode to whitelist this port
const PORT = 8080;
const knex = require('./db/knex.js');
const { resolve } = require("path");

const users = [];
const botName = "TeamStream"

const hostInfo = {
  videoId: null,
  time: 0,
  play: true,
  queue: [],
  index: 0,
}

let pingHostInterval;
const threshold = 0.9;

toxicity.load(threshold).then(model => {

  io.on("connection", socket => {
    // Create a session when user clicks to create

    socket.on('joinRoom', ({ username, room }) => {
      knex.from('users').where('session_id', room).then(rows => {
        //Note!: need to check if session is valid! and add references session id in migrations!!!!
        //if current session_id is empty
        if (rows.length === 0) {
          knex('users').insert({ id: socket.id, username: username, active: true, isHost: true, session_id: room }).returning('*').then((rows) => {
            const user = rows[0];

            socket.join(user.session_id);
            socket.emit("your id", socket.id);
            socket.emit('message', { id: 1, username: `TeamStreamBot`, message: 'Welcome to TeamStream!' });

            socket.broadcast
              .to(user.session_id)
              .emit('message', { id: 1, username: `TeamStreamBot`, message: `${user.username} has joined the chat` })

          })
        } else {
          knex('users').insert({ id: socket.id, username: username, active: true, isHost: false, session_id: room }).returning('*').then((rows) => {
            const user = rows[0];
            console.log("rows", user)

            socket.join(user.session_id);
            socket.emit('message', { id: 1, username: `TeamStreamBot`, message: 'Welcome to TeamStream!' });

            socket.broadcast
              .to(user.session_id)
              .emit('message', { id: 1, username: `TeamStreamBot`, message: `${user.username} has joined the chat` })
          })
        }
      })

    })
    // Runs when client disconnects
    socket.on('disconnect', () => {
      //const user = getCurrentUser(socket.id);
      knex.from('users').where('id', socket.id).update({active: false}).returning('*').then(rows => {
        const session_id = rows[0].session_id;
        //if(user.isHost)
        if (rows[0].isHost) {
          clearInterval(pingHostInterval);
          io.to(session_id).emit('session closed');
        }else {
          io.to(rows[0].session_id).emit(
            'message', { id: 1, username: `TeamStreamBot`, message: `${rows[0].username} has left the chat` })
        }
      });

    });

    
    socket.on("send message", body => {

      model && model.classify([body.body]).then(predictions => {
        predictions.map((item) => {
          if (item.results[0].match === true) {
            body.body = 'Francis'
          }
        })
        //const user = getCurrentUser(socket.id);
        knex.from('users').where('id', socket.id).then(rows => {
          const user = rows[0]
          const messageObj = createMsgObj(body, user)
          io.to(user.session_id).emit("message", messageObj)
        });
      });

    })

    socket.on("videoAction", action => {
      //const user = getCurrentUser(socket.id);
      knex.from('users').where('id', socket.id).then(rows => {
        io.to(rows[0].session_id).emit("videoAction", { action, hostInfo })
      })
    })

    // Listen for change in video time
    socket.on("videoTime", action => {
      //const user = getCurrentUser(socket.id);
      knex.from('users').where('id', socket.id).then(rows => {
        io.to(rows[0].session_id).emit("videoTime", { action })
      })
    })

    //if not a host, request for video info from the host
    socket.on("requestVideoInfo", action => {
      //need to know if user in this session_id is host
      knex.from('users').where('id', socket.id).then(rows => {
        const user = rows[0];
        if (!user.isHost) {
          socket.emit("provideVideoInfo", hostInfo)
        } else {
          //if host joins, get a modal to invite friends
          socket.emit("inviteFriends", "")
          //start pinging the host for info
          pingHostInterval = setInterval(() => {
            io.to(user.id).emit("pingHostForInfo", "");
          }, 200)
        }
      })
    })

    socket.on("HostInfo", info => {
      hostInfo.time = info.time
      hostInfo.play = info.play
      hostInfo.index = info.index

    })

    socket.on("addVideo", videoId => {
      //NOTE: add video to video table

      hostInfo.queue.push(videoId)
      //emits the updated queue to host
      knex.from('users').where('id', socket.id).then(rows => {
        const user = rows[0];

        //NOTE: sending an array of vidoId for that session ordered by id
        io.to(user.session_id).emit("updatedQueue", hostInfo.queue);
      })

    })
    socket.on("query-public-rooms", () => {
      const publicRooms = knex.select("*").from("sessions").where("public", true).then(sessions => {
        socket.emit("show-public-rooms", sessions)
      })
    })
  })

    // function userJoin(id, username, room) {
    //   // const user = { id, username, session_id };
    //   // users.push(user);
       
    // }

    // User leaves chat
  //   function userLeave(socket_id) {
      
  //     const index = users.findIndex(user => user.id === socket_id);

  // }

  // socket.on("addVideo", videoId => {
  //   hostInfo.queue.push(videoId)
  //   //emits the updated queue to host
  //   const user = getCurrentUser(socket.id);

  //   io.to(user.room).emit("updatedQueue", hostInfo.queue);
  // })

  

// })

// function userJoin(id, username, room) {
//   const user = { id, username, room };

//   users.push(user);

//   return user;
// }
//       if (index !== -1) {
//         return users.splice(index, 1)[0];
//       }
//     }
//     function getCurrentUser(socket_id) {
    

      // return users.find(user => user.id === socket_id);
    // }

    function createMsgObj(msg, user) {
      return {
        id: msg.id,
        message: msg.body,
        username: user.username
      }

    }



    server.listen(PORT, () => console.log("server is running on port 8080"));

  })