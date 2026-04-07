import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify.dto';
import { GoogleUser } from './strategies/google.strategy';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { SmtpMailService } from 'src/config/smtp-mail/smtp-mail.service';
import { RegisterDto } from './dto/register.dto';
import { successResponse } from 'src/common/response';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: SmtpMailService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateVerifyToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, purpose: 'email-verification' },
      { secret: this.config.getOrThrow('JWT_VERIFY_SECRET'), expiresIn: '15m' },
    );
  }

  private verifyToken(token: string, purpose: string): { sub: string } {
    try {
      const secret: string =
        purpose === 'email-verification'
          ? this.config.getOrThrow<string>('JWT_VERIFY_SECRET')
          : this.config.getOrThrow<string>('JWT_RESET_SECRET');

      const payload = this.jwt.verify<{ sub: string; purpose: string }>(token, {
        secret,
      });

      if (payload.purpose !== purpose) {
        throw new BadRequestException('Invalid token purpose');
      }

      return payload;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid or expired token');
    }
  }

  private async generateAndStoreCode(
    userId: string,
    type: 'verify' | 'reset',
  ): Promise<{ code: string; token: string }> {
    const code = randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    const hashedCode = await bcrypt.hash(code, 10);

    const token =
      type === 'verify'
        ? this.generateVerifyToken(userId)
        : this.jwt.sign(
            { sub: userId, purpose: 'password-reset' },
            {
              secret: this.config.getOrThrow('JWT_RESET_SECRET'),
              expiresIn: '15m',
            },
          );

    const data =
      type === 'verify'
        ? {
            registerCode: hashedCode as string,
            registerCodeToken: token,
            registerCodeExpiry: expiry,
          }
        : {
            resetPasswordCode: hashedCode as string,
            resetPasswordCodeToken: token,
            resetPasswordCodeExpiry: expiry,
          };

    await this.prisma.client.user.update({ where: { id: userId }, data });

    return { code, token };
  }

  // ─── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    try {
      const existing = await this.prisma.client.user.findUnique({
        where: { email: dto.email },
      });

      if (existing && existing.isEmailVerified) {
        throw new ConflictException('Email already in use');
      }

      // Allow re-registration if email was never verified
      if (existing && !existing.isEmailVerified) {
        await this.prisma.client.user.delete({ where: { id: existing.id } });
      }

      const hashed: string = await bcrypt.hash(dto.password, 10);

      const user = await this.prisma.client.user.create({
        data: { name: dto.name, email: dto.email, password: hashed },
      });

      const { code, token } = await this.generateAndStoreCode(
        user.id,
        'verify',
      );

      await this.mail.sendMail(user.email, 'Verify Your Email', `
        <p>Hi ${user.name},</p>
        <p>Thank you for registering. Please use the following verification code to verify your email address:</p>
        <h2>${code}</h2>
      `);

      return successResponse(
        'Registered successfully. Please check your email for the verification code.',
        { token },
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.log(error);
      
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  // ─── Verify Email ────────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    try {
      const payload = this.verifyToken(dto.token, 'email-verification');

      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new NotFoundException('User not found');

      if (user.isEmailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      if (!user.registerCode || !user.registerCodeExpiry || !user.registerCodeToken) {
        throw new BadRequestException(
          'No pending verification found. Please request a new code.',
        );
      }

      if (new Date() > user.registerCodeExpiry) {
        throw new BadRequestException(
          'Verification code has expired. Please request a new one.',
        );
      }

      if (user.registerCodeToken !== dto.token) {
        throw new BadRequestException(
          'Token does not match. Please request a new code.',
        );
      }

      const isCodeValid = await bcrypt.compare(dto.code, user.registerCode);
      if (!isCodeValid)
        throw new BadRequestException('Invalid verification code');

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          registerCode: null,
          registerCodeToken: null,
          registerCodeExpiry: null,
        },
      });

      return successResponse('Email verified successfully');
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.log(error);
      
      throw new InternalServerErrorException('Failed to verify email');
    }
  }

  // ─── Resend Verification ─────────────────────────────────────────────────────

  async resendVerification(dto: ResendVerificationDto) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { email: dto.email },
      });

      if (!user)
        throw new NotFoundException('No account found with this email');

      if (user.isEmailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      const { code, token } = await this.generateAndStoreCode(
        user.id,
        'verify',
      );

      await this.mail.sendMail(user.email, 'Resend Verification Code', `
        <p>Hi ${user.name},</p>
        <p>You requested to resend the verification code. Please use the following code to verify your email address:</p>
        <h2>${code}</h2>
      `);

      return successResponse(
        'Verification code resent. Please check your email.',
        { token },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.log(error);

      throw new InternalServerErrorException(
        'Failed to resend verification code',
      );
    }
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { email: dto.email },
      });

      if (!user) throw new UnauthorizedException('Invalid credentials');

      if (user.isDeleted) {
        throw new UnauthorizedException('This account has been deleted');
      }

      if (user.isBlocked) {
        throw new ForbiddenException(
          'Your account has been blocked. Please contact support',
        );
      }

      if (!user.password) {
        if (user.accountType === 'GOOGLE') {
          throw new ForbiddenException(
            'This account is registered with Google. Please use Google Login.',
          );
        }
        throw new UnauthorizedException('Invalid credentials');
      }

      const isMatch = await bcrypt.compare(dto.password, user.password);
      if (!isMatch) throw new UnauthorizedException('Invalid credentials');

      if (!user.isEmailVerified) {
        throw new ForbiddenException(
          'Please verify your email before logging in',
        );
      }

      const accessToken = this.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );
      const refreshToken = this.generateRefreshToken(user.id);

      const hashedRefresh: string = await bcrypt.hash(refreshToken, 10);

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefresh },
      });

      return successResponse('Login successful', {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          accountType: user.accountType,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.log(error);

      throw new InternalServerErrorException('Failed to login');
    }
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { email: dto.email },
      });

      // Prevent email enumeration
      if (!user || !user.isEmailVerified) {
        return successResponse(
          'If this email exists, a reset code has been sent',
        );
      }

      const { code, token } = await this.generateAndStoreCode(user.id, 'reset');

      await this.mail.sendMail(user.email, 'Password Reset', `
        <p>Hi ${user.name},</p>
        <p>You requested to reset your password. Please use the following code to reset your password:</p>
        <h2>${code}</h2>
      `);

      return successResponse(
        'If this email exists, a reset code has been sent',
        {
          token,
        },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to process forgot password request',
      );
    }
  }

  // ─── Reset Password ──────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = this.verifyToken(dto.token, 'password-reset');

      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.resetPasswordCode || !user.resetPasswordCodeExpiry) {
        throw new BadRequestException('Invalid or expired reset request');
      }

      if (new Date() > user.resetPasswordCodeExpiry) {
        throw new BadRequestException(
          'Reset code has expired. Please request a new one.',
        );
      }

      if (user.resetPasswordCodeToken !== dto.token) {
        throw new BadRequestException(
          'Token does not match. Please request a new code.',
        );
      }

      const isCodeValid = await bcrypt.compare(dto.code, user.resetPasswordCode);
      if (!isCodeValid) throw new BadRequestException('Invalid reset code');

      const hashed = await bcrypt.hash(dto.newPassword, 10);

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          resetPasswordCode: null,
          resetPasswordCodeToken: null,
          resetPasswordCodeExpiry: null,
        },
      });

      return successResponse('Password reset successfully');
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to reset password');
    }
  }

  // ─── Change Password ─────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
      });

      if (!user) throw new NotFoundException('User not found');

      if (!user.password) {
        if (user.accountType === 'GOOGLE') {
          throw new ForbiddenException(
            'This account is registered with Google. You cannot change your password here.',
          );
        }
        throw new NotFoundException('User password record not found');
      }

      const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
      if (!isMatch) throw new BadRequestException('Old password is incorrect');

      const hashed = await bcrypt.hash(dto.newPassword, 10);

      await this.prisma.client.user.update({
        where: { id: userId },
        data: { password: hashed },
      });

      return successResponse('Password changed successfully');
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to change password');
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    try {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
    } catch {
      // User may not exist, ignore
    }
    return successResponse('Logged out successfully');
  }

  // ─── Google Login ─────────────────────────────────────────────────────────

  async googleLogin(googleUser: GoogleUser) {
    try {
      let user = await this.prisma.client.user.findUnique({
        where: { email: googleUser.email },
      });

      console.log('[Google Login] existing user:', user?.id ?? 'none');

      if (user && user.isDeleted) {
        console.log('[Google Login] user isDeleted');
        throw new UnauthorizedException('This account has been deleted');
      }

      if (user && user.isBlocked) {
        console.log('[Google Login] user isBlocked');
        throw new ForbiddenException(
          'Your account has been blocked. Please contact support',
        );
      }

      if (!user) {
        user = await this.prisma.client.user.create({
          data: {
            name: googleUser.name,
            email: googleUser.email,
            profilePic: googleUser.profilePic,
            accountType: 'GOOGLE',
            isEmailVerified: true,
          },
        });
          console.log('[Google Login] new user created:', user.id);
          
        console.log('[Google Login] cloudSecret created for:', user.id);
      } else if (user.accountType !== 'GOOGLE') {
        console.log('[Google Login] accountType mismatch:', user.accountType);
        throw new ForbiddenException(
          'This email is registered with a password. Please login with email and password.',
        );
      }

      console.log('[Google Login] About to generate tokens for user:', {
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const accessToken = this.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );
      const refreshToken = this.generateRefreshToken(user.id);

      console.log('[Google Login] Tokens generated successfully');

      const hashedRefresh: string = await bcrypt.hash(refreshToken, 10);

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefresh },
      });

      return successResponse('Google login successful', {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          accountType: user.accountType,
          created_at: user.createdAt,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.error('Google login error:', error);
      throw new InternalServerErrorException('Failed to process Google login');
    }
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────────

  async refreshAccessToken(rawRefreshToken: string) {
    try {
      // Step 1: Verify JWT signature and expiry
      let payload: { sub: string };
      try {
        payload = this.jwt.verify<{ sub: string }>(rawRefreshToken, {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        });
      } catch {
        throw new UnauthorizedException('Session expired. Please login again');
      }

      // Step 2: Fetch user and validate state
      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          refreshToken: true,
          isDeleted: true,
          isBlocked: true,
        },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Session expired. Please login again');
      }

      if (user.isDeleted)
        throw new UnauthorizedException('This account has been deleted');
      if (user.isBlocked)
        throw new ForbiddenException(
          'Your account has been blocked. Please contact support',
        );

      // Step 3: Compare raw token with stored hash
      const isValid = await bcrypt.compare(rawRefreshToken, user.refreshToken);
      if (!isValid) {
        await this.prisma.client.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        throw new UnauthorizedException('Session expired. Please login again');
      }

      const accessToken = this.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );

      return successResponse('Token refreshed successfully', { accessToken });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to refresh access token');
    }
  }

  // ─── Get Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profilePic: true,
          accountType: true,
          isEmailVerified: true,
          createdAt: true,
        },
      });

      if (!user) throw new NotFoundException('User not found');

      return successResponse('Profile fetched successfully', user);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.log(error);
      
      throw new InternalServerErrorException('Failed to fetch profile');
    }
  }

  // ─── Token Generators ────────────────────────────────────────────────────────

  generateAccessToken(userId: string, email: string, role: string): string {
    return this.jwt.sign(
      { sub: userId, email, role },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '1h' },
    );
  }

  generateRefreshToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );
  }
}
