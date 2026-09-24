'use client';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SearchFilterBarProps {
  searchPlaceholder?: string;
  placeholder?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
  onSearchChange?: (value: string) => void;
  filters?: Array<{
    key?: string;
    label: string;
    options: Array<{ label: string; value: string }>;
    value: string;
    onChange: (value: string) => void;
  }>;
  actions?: React.ReactNode;
}

export function SearchFilterBar({
  searchPlaceholder = 'Search...',
  placeholder,
  searchValue,
  onSearch,
  onSearchChange,
  filters,
  actions,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#111111] p-4 rounded-lg border border-[#2A2A2A] mb-6">
      <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[#A3A3A3]" />
          </div>
          <Input
            type="text"
            placeholder={placeholder ?? searchPlaceholder}
            value={searchValue}
            onChange={(e) => (onSearchChange ?? onSearch)?.(e.target.value)}
            className="pl-9 bg-[#181818] border-[#2A2A2A] text-white focus-visible:ring-[#E50914] h-9"
          />
        </div>

        {filters && filters.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {filters.map((filter) => (
              <Select
                key={filter.key ?? filter.label}
                value={filter.value}
                onValueChange={filter.onChange}
              >
                <SelectTrigger className="w-full sm:w-[140px] bg-[#181818] border-[#2A2A2A] text-white h-9 focus:ring-[#E50914]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent className="bg-[#181818] border-[#2A2A2A] text-white">
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="focus:bg-[#202020] focus:text-white cursor-pointer">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
