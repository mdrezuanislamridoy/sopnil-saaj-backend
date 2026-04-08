import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  constructor(private readonly config: ConfigService) {}

  async initiateSslCommerzPayment(orderData: {
    orderId: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
  }) {
    // SSL Commerz integration
    const sslCommerzUrl = this.config.get('SSL_COMMERZ_URL');
    const storeId = this.config.get('SSL_COMMERZ_STORE_ID');
    const storePassword = this.config.get('SSL_COMMERZ_STORE_PASSWORD');

    if (!sslCommerzUrl || !storeId || !storePassword) {
      throw new BadRequestException('Payment gateway not configured');
    }

    const paymentData = {
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: orderData.amount.toString(),
      currency: 'BDT',
      tran_id: orderData.orderId,
      success_url: `${this.config.get('APP_URL')}/api/payment/success`,
      fail_url: `${this.config.get('APP_URL')}/api/payment/fail`,
      cancel_url: `${this.config.get('APP_URL')}/api/payment/cancel`,
      cus_name: orderData.customerName,
      cus_email: orderData.customerEmail,
      cus_phone: orderData.customerPhone,
      cus_add1: orderData.customerAddress,
      shipping_method: 'NO',
      product_name: 'Order',
      product_category: 'General',
      product_profile: 'general',
    };

    try {
      const response = await fetch(sslCommerzUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(paymentData).toString(),
      });

      const result = await response.json();

      if (result.status === 'SUCCESS') {
        return {
          paymentUrl: result.GatewayPageURL,
          sessionKey: result.sessionkey,
        };
      }

      throw new BadRequestException('Payment initiation failed');
    } catch (error) {
      throw new BadRequestException('Payment gateway error');
    }
  }

  async verifyPayment(transactionId: string) {
    const storeId = this.config.get('SSL_COMMERZ_STORE_ID');
    const storePassword = this.config.get('SSL_COMMERZ_STORE_PASSWORD');
    const validationUrl = this.config.get('SSL_COMMERZ_VALIDATION_URL');

    const params = new URLSearchParams({
      val_id: transactionId,
      store_id: storeId,
      store_passwd: storePassword,
    });

    try {
      const response = await fetch(`${validationUrl}?${params.toString()}`);
      const result = await response.json();
      return result.status === 'VALID' || result.status === 'VALIDATED';
    } catch (error) {
      return false;
    }
  }
}
