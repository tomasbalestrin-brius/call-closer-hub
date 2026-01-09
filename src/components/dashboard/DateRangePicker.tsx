import * as React from "react";
import { useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(dateRange);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTempRange(dateRange);
    }
    setOpen(isOpen);
  };

  const handleConfirm = () => {
    onDateRangeChange(tempRange);
    setOpen(false);
  };

  const setToday = () => {
    const today = new Date();
    setTempRange({ from: startOfDay(today), to: endOfDay(today) });
  };

  const setThisWeek = () => {
    const today = new Date();
    setTempRange({ 
      from: startOfWeek(today, { locale: ptBR }), 
      to: endOfWeek(today, { locale: ptBR }) 
    });
  };

  const setThisMonth = () => {
    const today = new Date();
    setTempRange({ from: startOfMonth(today), to: endOfMonth(today) });
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                  {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex gap-2 p-3 border-b">
            <Button variant="outline" size="sm" onClick={setToday}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={setThisWeek}>
              Esta Semana
            </Button>
            <Button variant="outline" size="sm" onClick={setThisMonth}>
              Este Mês
            </Button>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={tempRange?.from}
            selected={tempRange}
            onSelect={setTempRange}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
          <div className="p-3 border-t flex justify-end">
            <Button size="sm" onClick={handleConfirm}>
              <Check className="mr-2 h-4 w-4" />
              Confirmar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
