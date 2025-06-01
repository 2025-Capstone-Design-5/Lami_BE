import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /** 구글 ID로 사용자 조회 */
  findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  /** 사용자 생성 */
  createUser(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  /** 존재하면 조회, 없으면 생성 */
  async findOrCreate(data: Partial<User>): Promise<User> {
    let user = await this.findByGoogleId(data.googleId!);
    if (!user) {
      user = await this.createUser(data);
    }
    return user;
  }

  /** 사용자 토큰 업데이트 */
  async updateUserTokens(
    googleId: string,
    accessToken: string,
    refreshToken: string,
    issuedAt: Date,
  ): Promise<User> {
    const user = await this.findByGoogleId(googleId);
    if (!user) throw new Error(`User with googleId ${googleId} not found`);
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.tokenIssuedAt = issuedAt;
    return this.usersRepository.save(user);
  }
}
