import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./strategies/jwt.guard";
import { GoogleStrategy } from "./strategies/google.strategy";

@Module({
    imports: [PassportModule, JwtModule],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, JwtAuthGuard, GoogleStrategy],
    exports: [AuthService, JwtAuthGuard]
})
export class AuthModule { }