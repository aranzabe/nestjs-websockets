import { Injectable } from '@nestjs/common';

@Injectable()
export class WebsocketsService {
  create(createWebsocketDto: any) {
    return createWebsocketDto;
  }

  findAll() {
    return [];
  }

  findOne(id: number) {
    return { id };
  }

  update(id: number, updateWebsocketDto: any) {
    return { id, ...updateWebsocketDto };
  }

  remove(id: number) {
    return { removed: true, id };
  }
}
