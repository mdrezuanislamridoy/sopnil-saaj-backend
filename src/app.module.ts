import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SmtpMailModule } from './config/smtp-mail/smtp-mail.module';
import { CloudinaryModule } from './config/cloudinary/cloudinary.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { OrderModule } from './modules/order/order.module';
import { ReviewModule } from './modules/review/review.module';
import { DatabaseModule } from './services/prisma/database.module';
import { AuthGuard } from './common/guards/auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.modules';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SmtpMailModule,
    CloudinaryModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    AdminModule,
    CategoryModule,
    ProductModule,
    CartModule,
    WishlistModule,
    OrderModule,
    ReviewModule,
    JwtModule
  ],
  controllers: [AppController],
  providers: [AppService, { provide: 'APP_GUARD', useClass: AuthGuard }],
})
export class AppModule {}
