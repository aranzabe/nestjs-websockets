import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true })
  fromId: string;

  @Prop()
  toId?: string; // null si es mensaje general

  @Prop({ required: true })
  content: string;

  @Prop()
  room?: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
