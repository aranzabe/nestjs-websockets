import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class WebsocketsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // ----------------- Usuarios -----------------
  async addUser(socketId: string, name: string) {
    let user = await this.userModel.findOne({ socketId });
    if (!user) {
      user = new this.userModel({ socketId, name, connected: true });
    } else {
      user.connected = true;
    }
    return user.save();
  }

  async removeUser(socketId: string) {
    const user = await this.userModel.findOne({ socketId });
    if (user) {
      user.connected = false;
      await user.save();
    }
    return user;
  }

  async getConnectedUsers() {
    return this.userModel.find({ connected: true }).exec();
  }

  // ----------------- Mensajes -----------------
  async saveMessage(fromId: string, content: string, toId?: string, room?: string) {
    const message = new this.messageModel({ fromId, toId, content, room });
    return message.save();
  }

  async getMessagesByRoom(room: string) {
    return this.messageModel.find({ room }).sort({ createdAt: 1 }).exec();
  }

  async getPrivateMessages(userA: string, userB: string) {
    return this.messageModel
      .find({
        $or: [
          { fromId: userA, toId: userB },
          { fromId: userB, toId: userA },
        ],
      })
      .sort({ createdAt: 1 })
      .exec();
  }
}
