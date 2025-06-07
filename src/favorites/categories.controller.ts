import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** GET /categories?googleId=... */
  @Get()
  async getCategories(@Query('googleId') googleId: string) {
    const categories = await this.categoriesService.getCategories(googleId);
    return { data: categories };
  }

  /** POST /categories */
  @Post()
  async addCategory(@Body() body: CreateCategoryDto & { googleId: string }) {
    const { googleId, name } = body;
    const category = await this.categoriesService.addCategory(googleId, {
      name,
    });
    return { data: category };
  }

  /** DELETE /categories/:id?googleId=... */
  @Delete(':id')
  async removeCategory(
    @Param('id') id: string,
    @Query('googleId') googleId: string,
  ) {
    await this.categoriesService.removeCategory(googleId, id);
    return { message: 'Category deleted successfully' };
  }
}
