import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class RenderScheduler {
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await axios.get('https://sopnil-saaj-backend.onrender.com/health');
  }
}
