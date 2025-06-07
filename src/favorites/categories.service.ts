import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly usersService: UsersService,
  ) {}

  async getCategories(googleId: string): Promise<Category[]> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User with googleId ${googleId} not found`);
    }
    return this.categoryRepo.find({ where: { userId: user.id } });
  }

  async addCategory(
    googleId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User with googleId ${googleId} not found`);
    }
    const category = this.categoryRepo.create({
      userId: user.id,
      name: dto.name,
    });
    return this.categoryRepo.save(category);
  }

  async removeCategory(googleId: string, categoryId: string): Promise<void> {
    const user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      throw new NotFoundException(`User with googleId ${googleId} not found`);
    }
    await this.categoryRepo.delete({ id: categoryId, userId: user.id });
  }

  async findByIds(userId: string, ids: string[]): Promise<Category[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.categoryRepo.find({ where: { id: In(ids), userId } });
  }
}
