var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/vip/', function(request, response) {
    response.render('vip/index');
});

app.get('/mongolian/', function(request, response) {
    response.render('mongolian/index');
});



var server = app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

var io = require('socket.io')(server);

io.on('connection', (socket) => {
    let xdcctestpipe = require('./xdcctest-pipe.js')(socket);

    console.log("a client connected to the website");
    socket.on('disconnect', () => console.log("client disconnected"));
    socket.on('initiate', function (data) {
        xdcctestpipe.connectIRC(data.botname, data.packnum);
    });
    app.get('/mongolian/download/', function(req, res){
        xdcctestpipe.stream(req, res);
    });

});
