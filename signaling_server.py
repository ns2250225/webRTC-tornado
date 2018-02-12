# -*- coding: utf-8 -*-
import tornado
import tornado.websocket

class webRTCServer(tornado.websocket.WebSocketHandler):
    # 用户集合
    users = set()

    def open(self):
        # 连接建立时往房间添加用户
        self.users.add(self)

    def on_message(self, message):
        # 接收到消息时进行广播，除了自己
        for user in self.users:
            if user != self:
                user.write_message(message)

    def on_close(self):
        # 链接断开时移除用户
        self.users.remove(self)

    def check_origin(self, origin):
        # 允许跨域访问
        return True


if __name__ == '__main__':
    # 定义路由
    app = tornado.web.Application([
        (r"/", webRTCServer),
        ],
        debug=True
    )

    # 启动服务器
    http_server = tornado.httpserver.HTTPServer(app)
    http_server.listen(8000)
    tornado.ioloop.IOLoop.current().start()