import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  socketId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: true })
  connected: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
