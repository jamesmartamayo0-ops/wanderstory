import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import * as categoryService from "@/services/category.service";
import {
  saveCategory,
  deleteCategory,
} from "@/actions/category.actions";
import Button from "@/components/ui/Button";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const categories = await categoryService.getAllCategories();

  if (params.new) {
    return <CreateCategoryForm />;
  }

  if (params.edit) {
    const category = await categoryService.getCategoryById(params.edit);
    if (!category) {
      return <CategoryList categories={categories} />;
    }
    return <EditCategoryForm category={category} />;
  }

  return <CategoryList categories={categories} />;
}

async function CategoryList({
  categories,
}: {
  categories: Awaited<ReturnType<typeof categoryService.getAllCategories>>;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Link href="/admin/categories?new=true">
          <Button type="button" variant="primary">
            Add Category
          </Button>
        </Link>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Add your first category to get started."
          actionLabel="Add Category"
          actionHref="/admin/categories?new=true"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Journeys</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">{category.name}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {category.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="default">
                      {category._count.journeys}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/admin/categories?edit=${category.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </a>
                      <form action={deleteCategory.bind(null, category.id) as unknown as (formData: FormData) => void}>
                        <ConfirmDeleteButton confirmMessage="Are you sure you want to delete this category?" />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function CreateCategoryForm() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/categories"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to categories
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Add Category</h1>
      </div>

      <div className="max-w-lg rounded-lg border p-6">
        <form action={saveCategory as unknown as (formData: FormData) => void} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Link href="/admin/categories">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

async function EditCategoryForm({
  category,
}: {
  category: NonNullable<
    Awaited<ReturnType<typeof categoryService.getCategoryById>>
  >;
}) {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/categories"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to categories
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Edit Category</h1>
      </div>

      <div className="max-w-lg rounded-lg border p-6">
        <form action={saveCategory as unknown as (formData: FormData) => void} className="space-y-4">
          <input type="hidden" name="id" value={category.id} />
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={category.name}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={category.description ?? ""}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Link href="/admin/categories">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}