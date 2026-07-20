"use client";

type ConfirmDeleteButtonProps = {
  confirmMessage: string;
  className?: string;
  children?: React.ReactNode;
};

export default function ConfirmDeleteButton({
  confirmMessage,
  className = "text-sm text-red-600 hover:underline",
  children = "Delete",
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
