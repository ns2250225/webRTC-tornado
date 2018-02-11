from SimpleWebSocketServer import SimpleWebSocketServer, WebSocket

clients = []

class SimpleEcho(WebSocket):

    def handleMessage(self):
        for client in clients:
            if client != self: #judge
                print('-----on----')
                client.sendMessage(self.data)
            else:
                print('----skip-----')                

    def handleConnected(self):
        print(self.address, 'connected')
        clients.append(self) #add client

    def handleClose(self):
        print(self.address, 'closed')

server = SimpleWebSocketServer('', 8000, SimpleEcho)
server.serveforever()